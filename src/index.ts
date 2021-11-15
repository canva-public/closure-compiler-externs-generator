/* eslint-disable @typescript-eslint/no-require-imports, no-console */
// Copyright 2021 Canva Inc. All Rights Reserved.

/**
 * Generates Closure Compiler externs from the TypeScript declaration (.d.ts) files of libraries
 * in conf/libraries.js.
 *
 * Outputs a single extern file for each library with the path <out argument>/<module name>.js.
 */

import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import type * as ts from 'typescript';
import walkSync from 'walk-sync';
import type { ExternalSymbol } from './get_external_symbols';
import { getExternalSymbols } from './get_external_symbols';
import { Library } from './library';
export { applyDefaults, createApplyDefaults, Library } from './library';

/**
 * Generates a description of the symbol location in the declaration file, e.g.
 *   node_modules/@types/classnames/bind.d.ts (3:17)
 */
function positionDescription(
  {
    sourceFile,
    node,
  }: {
    sourceFile: ts.SourceFile;
    node: ts.Node;
  },
  outPath: string,
) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  const fileName = path.relative(outPath, sourceFile.fileName);
  return `${fileName} (${line + 1}:${character + 1})`;
}

export type FS = {
  mkdirSync: typeof fs.mkdirSync;
  writeFileSync: typeof fs.writeFileSync;
};

/**
 * Write the symbols to an extern file in the form:
 *  <global symbols>
 *  const __<module name> = {};
 *  <properties>
 *
 * e.g.:
 *  var classNames;
 *  const __classnames = {};
 *  __classnames.bind;
 *  __classnames.ClassArray;
 *  __classnames.ClassDictionary;
 *
 *  or (w/ debug info):
 *
 *  var classNames; // node_modules/@types/classnames/index.d.ts (24:15)
 *  const __classnames = {};
 *  __classnames.bind; // node_modules/@types/classnames/bind.d.ts (3:17)
 *  __classnames.ClassDictionary; // node_modules/@types/classnames/index.d.ts (14:11)
 *  __classnames.ClassArray; // node_modules/@types/classnames/index.d.ts (20:11)
 *
 */
function writeSymbols(
  to: string,
  identifier: string,
  symbols: ExternalSymbol[],
  debug: boolean,
  fileSystem: FS,
  outPath: string,
) {
  const declarations: string[] = [];
  const properties: string[] = [];
  const variableName = identifier.replace(/[^\w]/g, '_');

  const seenDeclarations = new Set();
  const seenProperties = new Set();

  if (!debug) {
    // we don't want them in source order, but alphabetically,
    // which is more stable to reorganizations inside the libraries
    symbols = symbols.sort((s1, s2) => s1.name.localeCompare(s2.name));
  }

  symbols.forEach((symbol) => {
    switch (symbol.type) {
      case 'DECLARATION':
        if (debug) {
          declarations.push(
            `var ${symbol.name}; // ${positionDescription(symbol, outPath)}`,
          );
        } else if (!seenDeclarations.has(symbol.name)) {
          seenDeclarations.add(symbol.name);
          declarations.push(`var ${symbol.name};`);
        }
        break;
      case 'PROPERTY':
        if (debug) {
          properties.push(
            `__${variableName}.${symbol.name}; // ${positionDescription(
              symbol,
              outPath,
            )}`,
          );
        } else if (!seenProperties.has(symbol.name)) {
          seenProperties.add(symbol.name);
          properties.push(`__${variableName}.${symbol.name};`);
        }
        break;
      default:
        /* istanbul ignore next */
        throw new Error(`Unknown symbol type ${symbol.type}`);
    }
  });

  const code =
    [
      '// @formatter:off',
      ...declarations,
      `const __${variableName} = {};`,
      ...properties,
    ].join(EOL) + EOL;

  fileSystem.mkdirSync(path.dirname(to), { recursive: true });
  fileSystem.writeFileSync(to, code);
}

/**
 * Returns a map of module identifiers to TS declaration files.
 */
function getDeclarationPaths(
  libraries: readonly Library[],
): Map<string, Set<string>> {
  return new Map(
    libraries.map((library): [string, Set<string>] => {
      // An annoying quirk of walkSync is the / prefix in absolute paths must be removed and then re-added.
      const globs = library.declarationGlobs.map((glob) =>
        path.resolve(glob).slice(1),
      );
      const paths = walkSync('/', { globs, directories: false }).map(
        (p) => '/' + p,
      );

      return [library.identifier, new Set(paths)];
    }),
  );
}

export function processLibraries(
  outPath: string,
  libraries: readonly Library[],
  debug: boolean,
  fileSystem: FS,
): void {
  const libraryToDeclarationPaths = getDeclarationPaths(libraries);

  // Collect all declaration paths.
  // Some declaration files import common declaration files, e.g react-dnd imports the react
  // types. We pass the set of all declaration files to getExternalSymbols as don't follow
  // to prevent duplicates, e.g. react-dnd including all the react symbols.
  const allPaths = new Set<string>();
  for (const paths of libraryToDeclarationPaths.values()) {
    paths.forEach((p) => allPaths.add(p));
  }

  for (const [safeModuleName, declarationPaths] of libraryToDeclarationPaths) {
    const symbols = getExternalSymbols(declarationPaths, allPaths);
    if (symbols.length) {
      writeSymbols(
        path.join(outPath, `${safeModuleName}.js`),
        safeModuleName,
        symbols,
        debug,
        fileSystem,
        outPath,
      );
    }
  }
}
