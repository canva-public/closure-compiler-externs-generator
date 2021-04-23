#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Library } from './library';
import assert from 'assert';
import { processLibraries } from './index';

const name = '@canva-public/closure-compiler-externs-generator';

function usage() {
  console.log(`usage: ${name} --out <dir> --librariesPath <path>  [--debug]
  
  Generates Closure Compiler externs from the TypeScript declaration (.d.ts) files of libraries in
  the given libraries files.

    --librariesPath expects a file exporting an array of library definitions as a named export called 'libraries'.
  
    The optional '--debug' flag will add line information to the output
  
  example:
  ${name} --librariesPath /path/to/libraries.js --out externs/generated/`);
}

export function main(): void {
  let out: string | undefined;
  let libraries: Library[] | undefined;
  let debug = false;
  const args = process.argv.slice(2);
  while (args.length) {
    const arg = args.shift();
    switch (arg) {
      case '--help':
        usage();
        process.exit();
        break;
      case '--out':
        out = args.shift();
        break;
      case '--librariesPath': {
        const librariesPath = args.shift();
        assert(librariesPath, 'No libraries path given');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        libraries = require(path.resolve(librariesPath)).libraries;
        break;
      }
      case '--debug':
        debug = true;
        break;
      default:
        console.log('error: unknown argument: ' + arg);
        process.exit(1);
    }
  }

  assert(out, 'missing --out argument');
  assert(libraries, 'missing --librariesPath argument');

  const outPath: string = path.resolve(out);

  processLibraries(outPath, libraries, debug, fs);
}

main();
