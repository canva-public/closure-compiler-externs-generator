// Copyright 2021 Canva Inc. All Rights Reserved.

import type fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

function createHost(
  fileSystem: FS,
  cwd: string,
): Required<Omit<ts.ModuleResolutionHost, 'trace'>> {
  function stat(path: string): fs.Stats | undefined {
    try {
      return fileSystem.statSync(path);
    } catch {
      return undefined;
    }
  }

  return {
    fileExists: (fileName) => !!stat(fileName)?.isFile(),
    readFile: (fileName) => {
      try {
        return fileSystem.readFileSync(fileName, 'utf-8');
      } catch {
        return undefined;
      }
    },
    directoryExists: (directoryName) => !!stat(directoryName)?.isDirectory(),
    getCurrentDirectory: () => cwd,
    getDirectories: (parentPath) => {
      try {
        return fileSystem
          .readdirSync(parentPath)
          .filter((itemPath) =>
            fileSystem.statSync(path.join(parentPath, itemPath)).isDirectory(),
          );
      } catch {
        return [];
      }
    },
    realpath: fileSystem.realpathSync,
  };
}

function createResolveModule(
  fileSystem: FS,
  resolveFrom: string,
): (moduleName: string, containingFile: string) => string | undefined {
  const host = createHost(fileSystem, resolveFrom);

  return function (moduleName, containingFile) {
    const result = ts.resolveModuleName(
      moduleName,
      containingFile,
      ts.getDefaultCompilerOptions(),
      host,
      // TODO Use cache
    );
    return result.resolvedModule && result.resolvedModule.resolvedFileName;
  };
}

export const enum SymbolType {
  /**
   * The names of declared namespaces, functions, variables, classes and interfaces.
   */
  DECLARATION = 'DECLARATION',
  /**
   * The names of properties and methods that appear in any type or value expression.
   */
  PROPERTY = 'PROPERTY',
}

export type ExternalSymbol = {
  type: SymbolType;
  name: string;
  node: ts.Node;
  sourceFile: ts.SourceFile;
};

// there are some references that we don't want to add to the externs,
// as they are never used in conjunction with Closure Compiler anyway
const ignored_typings: RegExp[] = [
  // we'll never need the node typings on the client side, only when using within node
  // sax and react-dom have '/// <reference types="node" />' for example, which would otherwise
  // pull them in
  /node_modules\/@types\/node/,
];
const isNotIgnored = (f: ts.SourceFile) =>
  ignored_typings.every((ignored) => !ignored.test(f.fileName));

export type FS = Pick<
  typeof fs,
  'statSync' | 'readFileSync' | 'readdirSync' | 'realpathSync'
>;

/**
 * Generates the list of property and symbol names used in vendor libraries that must not be
 * renamed during minification and/or mangling. Names are taken from TypeScript declaration files.
 *
 * @param files the set of declaration files to read symbols from.
 * @param dontFollow a set of declaration files to ignore when seen in import or reference
 *     statements.
 * @param readFileSync
 * @param resolveModule
 * @param resolveFrom
 */
export function getExternalSymbols(
  files: Iterable<string>,
  dontFollow: Iterable<string> = [],
  fileSystem: FS,
  resolveFrom: string,
): ExternalSymbol[] {
  const sourceFiles = Array.from(files, (file) => {
    const source = fileSystem.readFileSync(file, 'utf-8');
    return ts.createSourceFile(file, source, ts.ScriptTarget.ES2015, true);
  });

  const mergedDontFollow = new Set(
    [...files, ...dontFollow].map((p) => path.resolve(p)),
  );

  const resolveModule = createResolveModule(fileSystem, resolveFrom);

  return sourceFiles
    .filter(isNotIgnored)
    .reduce((symbols: ExternalSymbol[], file) => {
      return symbols.concat(
        findSymbolNames(
          file,
          mergedDontFollow,
          fileSystem.readFileSync,
          resolveModule,
        ),
      );
    }, []);
}

/**
 * Walks the source file's AST and populates the builder with property and declared symbol names.
 */
export function findSymbolNames(
  sourceFile: ts.SourceFile,
  dontFollow: Set<string>,
  readFileSync: FS['readFileSync'],
  resolveModule: (
    moduleName: string,
    containingFile: string,
  ) => string | undefined,
): ExternalSymbol[] {
  const symbols: ExternalSymbol[] = [];
  visitNode(sourceFile);
  return symbols;

  function visitNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.SourceFile: // top level source file node
        visitSourceFile(sourceFile);
        break;
      case ts.SyntaxKind.ImportDeclaration: // import "./foo"
        visitModuleSpecifier(node as ts.ImportDeclaration);
        break;
      case ts.SyntaxKind.ExportDeclaration: // export foo1; export { foo } from './foo';
        visitModuleSpecifier(node as ts.ExportDeclaration);
        break;
      case ts.SyntaxKind.ModuleDeclaration: // namespace Foo {
        visitModuleDeclaration(node as ts.ModuleDeclaration);
        break;
      case ts.SyntaxKind.VariableStatement: // const foo1, foo2
        visitVariableStatement(node as ts.VariableStatement);
        break;
      case ts.SyntaxKind.EnumMember: // enum Baa { Foo }
      case ts.SyntaxKind.MethodSignature: // type { foo(): string }
      case ts.SyntaxKind.MethodDeclaration: // const { foo() { } }
      case ts.SyntaxKind.PropertySignature: // type { foo: string }
      case ts.SyntaxKind.PropertyDeclaration: // class { foo1: 'apple', foo2 = 'banana' }
      case ts.SyntaxKind.PropertyAssignment: // const { foo: 'apple' }
      case ts.SyntaxKind.EnumDeclaration: // enum Foo { }
      case ts.SyntaxKind.FunctionDeclaration: // function foo() { }
      case ts.SyntaxKind.ClassDeclaration: // class Foo { }
        visitNamedDeclaration(node as ts.NamedDeclaration);
        break;
      // Interface and types are ignored as they are removed by TypeScript.
      case ts.SyntaxKind.InterfaceDeclaration: // interface Foo {}
      case ts.SyntaxKind.TypeAliasDeclaration: // type Foo {}
      default:
        break;
    }
    ts.forEachChild(node, visitNode);
  }

  function visitModuleSpecifier(node: { moduleSpecifier?: ts.Expression }) {
    if (!node.moduleSpecifier) {
      return;
    }

    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      /* istanbul ignore next */
      throw new Error('Only string module specifiers are supported');
    }

    const fileReference = node.moduleSpecifier.text;
    const file = resolveModule(fileReference, sourceFile.fileName);
    if (file) {
      loadReferencedFile(file);
    }
  }

  function visitSourceFile(node: ts.SourceFile) {
    // /// <reference path="sub/ref.entry.d.ts" />
    node.referencedFiles.forEach((r) => {
      loadReferencedFile(
        ts.resolveTripleslashReference(r.fileName, sourceFile.fileName),
      );
    });
  }

  function loadReferencedFile(file: string) {
    file = path.resolve(file);
    if (!dontFollow.has(file)) {
      dontFollow.add(file);
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf-8'),
        ts.ScriptTarget.ES2015,
        true,
      );
      symbols.push(
        ...findSymbolNames(source, dontFollow, readFileSync, resolveModule),
      );
    }
  }

  function visitVariableStatement(node: ts.VariableStatement) {
    const type = isDeclared(node)
      ? SymbolType.DECLARATION
      : SymbolType.PROPERTY;
    node.declarationList.declarations.forEach((dec) => {
      visitName(dec, type);
    });
  }

  function visitNamedDeclaration(node: ts.NamedDeclaration) {
    const type = isDeclared(node)
      ? SymbolType.DECLARATION
      : SymbolType.PROPERTY;
    visitName(node, type);
  }

  function visitModuleDeclaration(node: ts.ModuleDeclaration) {
    if (!(node.flags & ts.NodeFlags.Namespace)) {
      return;
    }

    const type =
      isDeclared(node) && node.flags ^ ts.NodeFlags.NestedNamespace
        ? SymbolType.DECLARATION
        : SymbolType.PROPERTY;

    visitName(node, type);
  }

  function visitName(node: ts.NamedDeclaration, type: SymbolType) {
    const name = node.name;
    if (name && ts.isIdentifier(name)) {
      symbols.push({
        type,
        name: name.text,
        node: name,
        sourceFile,
      });
    }
  }

  /**
   * Checks if the node has the 'declare' modifier which indicates the symbols is exposed as a
   * global. e.g.
   *  declare namespace React {
   *  declare class Fscreen {
   */
  function isDeclared(node: ts.Node): boolean {
    return (
      !!node.modifiers &&
      !!node.modifiers.find((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
    );
  }
}
