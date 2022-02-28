#!/usr/bin/env node

import { generateExterns, generateExternsForPackages, Package } from './index';
import yargs from 'yargs';

export function main(): void {
  const args = yargs
    .command(
      'packages <packages...>',
      'Generates Closure Compiler externs from the TypeScript declaration (.d.ts) files of the given packages.',
      (yargs) =>
        yargs
          .positional('packages', {
            describe: 'packages',
            array: true,
            type: 'string',
            demandOption: true,
          })
          .option('package-root', { type: 'string', default: 'node_modules' })
          .example(
            '$0 packages react react-dom',
            'Generates externs for the type files of the react and react-dom packages.',
          ),
    )
    .command(
      'declarations [identifier] <declarations...>',
      'Generates Closure Compiler externs from the provided declaration files.',
      (yargs) =>
        yargs
          .positional('declarations', {
            describe: 'declarations',
            demandOption: true,
            array: true,
            type: 'string',
          })
          .positional('identifier', {
            describe: 'identifier',
            type: 'string',
            demandOption: true,
          })
          .example(
            '$0 declarations my_externs foo.d.ts baa.d.ts',
            'Generates externs from the foo and baa files and outputs them to the my_externs.js file',
          ),
    )
    .option('debug', { type: 'boolean' })
    .option('out-path', { type: 'string', default: process.cwd() })
    .parseSync();

  const command = args._[0];
  switch (command) {
    case 'packages': {
      const packages: Package[] = args.packages.map((name) => ({ name }));
      generateExternsForPackages({ ...args, packages });
      break;
    }
    case 'declarations': {
      generateExterns({
        ...args,
        declarationFiles: args.declarations,
        identifier: args.identifier,
      });
      break;
    }
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

main();
