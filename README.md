# Generate Externs from Typescript definitions

[![build](https://github.com/canva-public/closure-compiler-externs-generator/actions/workflows/node.js.yml/badge.svg)](https://github.com/canva-public/closure-compiler-externs-generator/actions/workflows/node.js.yml)
[![npm](https://img.shields.io/npm/v/@canva-public/closure-compiler-externs-generator.svg)](https://www.npmjs.com/package/@canva-public/closure-compiler-externs-generator)

Generates externs for closure compiler from the TypeScript declarations of libraries listed in a given libraries definition file.

## Installation

```bash
# yarn
yarn add -D @canva-public/closure-compiler-externs-generator

# npm
npm install --save-dev @canva-public/closure-compiler-externs-generator
```

## Usage

```
npx @canva-public/closure-compiler-externs-generator --librariesPath ./path/to/libraries.js --out ./my_externs
```

To include symbol source information in the output add the `--debug` flag to the execution.

## Why Externs?

Closure compiler minifies symbols such as property names and variables. When calling libraries
that are not closure compiled from code that is the symbols will be incorrect, for example:

```js
import * as React from 'react';
React.createElement('div', { className: 'foo' });
```

Would become:

```js
import * as a from 'react';
a.b('div', { c: 'foo' });
```

To avoid this, closure compiler must be made aware of all symbols not must not be minimised, e.g.
in the above example, `createElement` and `className` must not be minimised.

Closure compiler has the concept of externs which have a similar role to TypeScript declaration files.
They declare the types of an external library that will be included in the closure compilation.
Closure uses those types to do both type checking, and to avoid minifying any symbol names used
by the libraries.

However, as we use TypeScript for type checking our generated externs only need to include
the symbol names and not the type information.

## How it works

Most libraries we use now include TypeScript declaration files, which include all the symbols
used by a library. So this tool generates externs for a library in 4 steps:

1. Search for declaration files under the globs specified in your library definition, usually `node_modules/<library name>/**/*.d.ts` and `node_modules/@types/<library name>/**/*.d.ts`.
2. Parse and traverse the declaration files for symbols that must not be minified, e.g. property names, class names. For a full list see `findSymbolNames` in `get_external_symbols.ts`.
3. Recurse into any imported declaration files.
4. Write the found symbols into `<out>/<libary name>.js`.

## Caveats

The generated externs only contain symbol data, no type information.
