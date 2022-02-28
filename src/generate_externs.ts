import { ExternalSymbol, getExternalSymbols } from './get_external_symbols';
import path from 'path';
import { EOL } from 'os';
import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * Generates externs for the provided declaration files.
 */
export function generateExterns(opts: {
  /** The path to write externs to. */
  outPath: string;
  /** The name that will be used for output file and namespace in the generated externs. e.g. 'react' */
  identifier: string;
  /** The declaration files, e.g. ['declarations/react-dnd.d.ts'] */
  declarationFiles: Iterable<string>;
  /** Declaration files that will not be followed when imported, e.g. ['declarations/react.d.ts'] */
  ignoreDeclarationFiles?: Iterable<string>;
  fileSystem?: Pick<typeof fs, 'mkdirSync' | 'writeFileSync'>;
  debug?: boolean;
}): void {
  const symbols = getExternalSymbols(
    opts.declarationFiles,
    opts.ignoreDeclarationFiles,
  );
  if (symbols.length === 0) {
    return;
  }

  writeSymbols(
    path.join(opts.outPath, `${opts.identifier}.js`),
    opts.identifier,
    symbols,
    !!opts.debug,
    opts.fileSystem || fs,
    opts.outPath,
  );
}

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
  fileSystem: Pick<typeof fs, 'mkdirSync' | 'writeFileSync'>,
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
