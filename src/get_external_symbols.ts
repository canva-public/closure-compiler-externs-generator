// Copyright 2021 Canva Inc. All Rights Reserved.

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { warn } from './logging';

const defaultReadFileSync = (path: string) => fs.readFileSync(path, 'utf8');
const getDefaultResolveModule = (compilerOptions: ts.CompilerOptions) => (
  moduleName: string,
  containingFile: string,
): string | undefined => {
  const result = ts.resolveModuleName(
    moduleName,
    containingFile,
    compilerOptions,
    ts.sys,
  );
  return result.resolvedModule && result.resolvedModule.resolvedFileName;
};

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

const isDefined = <T>(value?: T | null): value is T => value != null;

/**
 * Generates the list of property and symbol names used in vendor libraries that must not be
 * renamed during minification and/or mangling. Names are taken from TypeScript declaration files.
 *
 * @param files the set of declaration files to read symbols from.
 * @param dontFollow a set of declaration files to ignore when seen in import or reference
 *     statements.
 * @param readFileSync
 * @param resolveModule
 */
export function getExternalSymbols(
  program: ts.Program,
  files: Iterable<string>,
  dontFollow: Iterable<string> = [],
  readFileSync: typeof defaultReadFileSync = defaultReadFileSync,
  resolveModule?: ReturnType<typeof getDefaultResolveModule>,
): ExternalSymbol[] {
  const compilerOptions = program.getCompilerOptions();

  const realResolveModule =
    resolveModule ?? getDefaultResolveModule(compilerOptions);

  const sourceFiles = Array.from(files)
    .map(program.getSourceFile)
    .filter(isDefined)
    .filter(isNotIgnored);

  const mergedDontFollow = new Set(
    [...files, ...dontFollow].map((p) => path.resolve(p)),
  );
  return sourceFiles.reduce((symbols: ExternalSymbol[], file) => {
    return symbols.concat(
      findSymbolNames(
        program,
        file,
        mergedDontFollow,
        readFileSync,
        realResolveModule,
      ),
    );
  }, []);
}

/**
 * Walks the source file's AST and populates the builder with property and declared symbol names.
 */
function findSymbolNames(
  program: ts.Program,
  sourceFile: ts.SourceFile,
  dontFollow: Set<string>,
  readFileSync: typeof defaultReadFileSync,
  resolveModule: ReturnType<typeof getDefaultResolveModule>,
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
      case ts.SyntaxKind.TypeAliasDeclaration: // type Foo = ...
        visitTypeAliasDeclaration(node as ts.TypeAliasDeclaration);
        break;
      // Interfaces are ignored as they are removed by TypeScript.
      case ts.SyntaxKind.InterfaceDeclaration: // interface Foo {}
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

      // Try to fetch the source file directly from the main program instance, falling back to creating an unchecked new one
      const source =
        program.getSourceFile(file) ??
        ts.createSourceFile(
          file,
          readFileSync(file),
          ts.ScriptTarget.ES2015,
          true,
        );

      symbols.push(
        ...findSymbolNames(
          program,
          source,
          dontFollow,
          readFileSync,
          resolveModule,
        ),
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

  function visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration) {
    const type = node.type;
    switch (type.kind) {
      case ts.SyntaxKind.MappedType:
        visitMappedTypeNode(type as ts.MappedTypeNode);
        break;
    }
  }

  function visitMappedTypeNode(node: ts.MappedTypeNode) {
    // The constraint in mapped types is the RHS of the `in` keyword. If that's
    // somehow missing, bail early. We also ignore `keyof` types - the keys will
    // be picked up by other node visitors.
    const constraint = node.typeParameter.constraint;
    if (
      constraint == null ||
      (ts.isTypeOperatorNode(constraint) &&
        constraint.operator === ts.SyntaxKind.KeyOfKeyword)
    ) {
      return;
    }

    // We'll need the type checker past this point, grab a reference to it. This
    // will only incur the penalty of instantiating the checker one per Program.
    const checker = program.getTypeChecker();

    // Fetch the underlying type of the constraint. There's a rare case where TS
    // cannot resolve the symbol for the node, and throws - typically due to a
    // RHS that is imported from an unchecked file. It's safe to ignore these errors.
    let constraintType: ts.Type;
    try {
      constraintType = checker.getTypeAtLocation(constraint);
    } catch {
      warnUnresolvedConstraintType(constraint);
      return;
    }

    // Resolve the constraint to an array of its union members
    const constraintMemberTypes = constraintType.isUnion()
      ? constraintType.types
      : [constraintType];

    const unresolvedTypes: ts.Type[] = [];
    for (const memberType of constraintMemberTypes) {
      // If we encounter a type parameter, we can't reliably resolve every possible
      // parameter without checking every usage of it.
      // Cast is required due to over-narrowing by TS.
      const typeParameters = memberType.isTypeParameter()
        ? [memberType]
        : (memberType as ts.Type).aliasTypeArguments?.filter((type) =>
            type.isTypeParameter(),
          );
      if (typeParameters != null && typeParameters.length > 0) {
        unresolvedTypes.push(...typeParameters);
        continue;
      }

      // Only tracking string literals, other possible values will either be ignored
      // by CC (numeric literals), or caught by other visitors.
      if (!memberType.isStringLiteral()) {
        continue;
      }

      visitStringLiteralType(memberType, constraint);
    }

    if (unresolvedTypes.length > 0) {
      warnUnresolvedTypeParameters(
        node.parent as ts.TypeAliasDeclaration,
        unresolvedTypes,
      );
    }
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

  function visitStringLiteralType(type: ts.StringLiteralType, node: ts.Node) {
    symbols.push({
      type: SymbolType.PROPERTY,
      name: type.value,
      node,
      sourceFile,
    });
  }

  function warnUnresolvedConstraintType(node: ts.TypeNode) {
    const formattedLocation = formatLocationForNode(node);
    warn(
      `Constraint ${node.getText()} at ${formattedLocation} could not be resolved, and was ignored.`,
    );
  }

  function warnUnresolvedTypeParameters(
    typeAlias: ts.TypeAliasDeclaration,
    typeParameters: ts.Type[],
  ) {
    const checker = program.getTypeChecker();
    const formattedLocation = formatLocationForNode(typeAlias);
    const formattedTypeParameters = typeParameters
      .map((type) => checker.typeToString(type))
      .join(', ');

    warn(
      `Type alias ${typeAlias.name.getText()} at ${formattedLocation} contains unresolved type parameter(s) ${formattedTypeParameters}.`,
    );
  }

  function formatLocationForNode(node: ts.Node) {
    const sourceFile = node.getSourceFile();
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return `${sourceFile.fileName}:${location.line}:${location.character}`;
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
