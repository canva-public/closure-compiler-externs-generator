# Generate Externs from Typescript definitions

[![build](https://github.com/canva-public/closure-compiler-externs-generator/actions/workflows/node.js.yml/badge.svg)](https://github.com/canva-public/closure-compiler-externs-generator/actions/workflows/node.js.yml)
[![npm](https://img.shields.io/npm/v/@canva/closure-compiler-externs-generator.svg)](https://www.npmjs.com/package/@canva/closure-compiler-externs-generator)

Generates externs for closure compiler from the TypeScript declarations of libraries listed in a given libraries definition file.

## Installation

```bash
# yarn
yarn add -D @canva/closure-compiler-externs-generator

# npm
npm install --save-dev @canva/closure-compiler-externs-generator
```

## Usage

### CLI

```js
// path/to/libraries.js, must be CJS
const CCEG = require('@canva/closure-compiler-externs-generator');
const applyDefaults = createApplyDefaults(__dirname);
module.exports.libraries = [{ ... }, { ... }].map(applyDefaults);
```

```bash
npx @canva/closure-compiler-externs-generator --librariesPath ./path/to/libraries.js --out ./my_externs
```

To include symbol source information in the output add the `--debug` flag to the execution, paths will be relative to current working directory.

### API

If in a CommonJS context:

```js
const CCEG = require('@canva/closure-compiler-externs-generator');
const fs = require('node:fs');
const resolveFrom = __dirname;
```

If in a ES module context (NodeJS v12 and up):

```js
import CCEG from '@canva/closure-compiler-externs-generator';
import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const resolveFrom = dirname(fileURLToPath(import.meta.url));
```

Then use as follows:

```js
const applyDefaults = CCEG.createApplyDefaults(resolveFrom);
const libraries = [{ ... }, { ... }].map(applyDefaults);

CCEG.processLibraries(
  // Where externs will be written
  './my_externs',
  libraries,
  // `true` to include symbol source information
  false,
  fs,
);
```

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

- The generated externs only contain symbol data, no type information.
- Only `main` imports are supported. Imports like `require('foo/bar')` will have unpredictable results.

## Releasing

- Bump the version of `package.json` to a meaningful version for the changes since the last release (we follow semver).
- To do a dry-run of the release and what would go out in the package you can manually execute the [npm-publish](https://github.com/canva-public/closure-compiler-externs-generator/actions/workflows/npm-publish.yml) workflow on the `main` branch. It will do a dry-run publish (not actually publish the new version).
- Draft a new release in the github project - please use a tag named `vX.X.X` (where `X.X.X` is the new to-be-releases semver of the package - please add as many detail as possible to the release description.
- Once you're ready, `Publish` the release. Publishing will trigger the [npm-publish](https://github.com/canva-public/closure-compiler-externs-generator/actions/workflows/npm-publish.yml) workflow on the tag and do the actual publish to npm.
