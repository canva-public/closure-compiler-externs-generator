// Copyright 2021 Canva Inc. All Rights Reserved.

import {
  ExternalSymbol,
  findSymbolNames,
  RequiredFS,
} from '../src/get_external_symbols';
import { getExternalSymbols, SymbolType } from '../src/get_external_symbols';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import ts from 'typescript';

describe('getExternalSymbols', () => {
  it('follows imports', () => {
    expect.hasAssertions();
    testSymbolLookup(
      {
        '/src/entry.d.ts': 'import "./foo"',
        '/src/foo.d.ts': 'declare const foo: string;',
      },
      ['/src/entry.d.ts'],
      [],
      [{ name: 'foo', type: SymbolType.DECLARATION }],
    );
  });

  it('follows exports with module specifiers', () => {
    expect.hasAssertions();
    testSymbolLookup(
      {
        '/src/entry.d.ts': 'export { default } from "./foo"',
        '/src/foo.d.ts': 'declare const foo: string;',
      },
      ['/src/entry.d.ts'],
      [],
      [{ name: 'foo', type: SymbolType.DECLARATION }],
    );
  });

  it('follows file references', () => {
    expect.hasAssertions();
    testSymbolLookup(
      {
        '/src/entry.d.ts': '/// <reference path="sub/ref.entry.d.ts" />',
        '/src/sub/ref.entry.d.ts': 'declare const foo: string;',
      },
      ['/src/entry.d.ts'],
      [],
      [{ name: 'foo', type: SymbolType.DECLARATION }],
    );
  });

  it('does not follow file references that in the dontFollow list', () => {
    expect.hasAssertions();
    testSymbolLookup(
      {
        '/src/entry.d.ts': '/// <reference path="sub/ref.entry.d.ts" />',
        '/src/sub/ref.entry.d.ts': 'declare const foo: string;',
      },
      ['/src/entry.d.ts'],
      ['/src/sub/ref.entry.d.ts'],
      [],
    );
  });

  it('gets properties from an interface', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `interface Foo {
        prop: string;
        method(): string;
      }`,
      [
        { name: 'prop', type: SymbolType.PROPERTY },
        { name: 'method', type: SymbolType.PROPERTY },
      ],
    );
  });

  it('gets properties from a type', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `type Foo {
        prop: string;
        method(): string;
      }`,
      [
        { name: 'prop', type: SymbolType.PROPERTY },
        { name: 'method', type: SymbolType.PROPERTY },
      ],
    );
  });

  it('gets properties from a const', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `
      const Foo = {
        prop: 'apple';
        method() { return 'banana' };
      }`,
      [
        { name: 'Foo', type: SymbolType.PROPERTY },
        { name: 'prop', type: SymbolType.PROPERTY },
        { name: 'method', type: SymbolType.PROPERTY },
      ],
    );
  });

  it('gets properties from a class', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `
      class Foo {
        prop1 = 'banana'; 
        prop2: 'apple';
        method() { return 'banana' };
      }`,
      [
        { name: 'Foo', type: SymbolType.PROPERTY },
        { name: 'prop1', type: SymbolType.PROPERTY },
        { name: 'prop2', type: SymbolType.PROPERTY },
        { name: 'method', type: SymbolType.PROPERTY },
      ],
    );
  });

  it('ignores modules', () => {
    expect.hasAssertions();
    testSymbolExtraction('declare module Module { }', []);
  });

  it('gets properties and declarations from namespaces', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `
      declare namespace Parent.Nested { 
        namespace Child { }
      }`,
      [
        { name: 'Parent', type: SymbolType.DECLARATION },
        { name: 'Nested', type: SymbolType.PROPERTY },
        { name: 'Child', type: SymbolType.PROPERTY },
      ],
    );
  });

  it('get properties from an enum', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `
      const enum Foo { 
        BAA = 1,
      }`,
      [
        { name: 'Foo', type: SymbolType.PROPERTY },
        { name: 'BAA', type: SymbolType.PROPERTY },
      ],
    );
  });

  it('gets declarations from declared functions, classes and variables', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `
      declare enum Enum { };
      declare function Function(): string;
      declare class Class { };
      declare const Const: string;
      declare var Var: string;
      declare let Let: string;
      `,
      [
        { name: 'Enum', type: SymbolType.DECLARATION },
        { name: 'Function', type: SymbolType.DECLARATION },
        { name: 'Class', type: SymbolType.DECLARATION },
        { name: 'Const', type: SymbolType.DECLARATION },
        { name: 'Var', type: SymbolType.DECLARATION },
        { name: 'Let', type: SymbolType.DECLARATION },
      ],
    );
  });

  it('gets properties from non-declared functions, classes and variables', () => {
    expect.hasAssertions();
    testSymbolExtraction(
      `
      enum Enum { };
      function Function(): string;
      class Class { };
      const Const: string;
      var Var: string;
      let Let: string;
      `,
      [
        { name: 'Enum', type: SymbolType.PROPERTY },
        { name: 'Function', type: SymbolType.PROPERTY },
        { name: 'Class', type: SymbolType.PROPERTY },
        { name: 'Const', type: SymbolType.PROPERTY },
        { name: 'Var', type: SymbolType.PROPERTY },
        { name: 'Let', type: SymbolType.PROPERTY },
      ],
    );
  });

  function testSymbolLookup(
    fsState: DirectoryJSON,
    declarationFiles: string[],
    dontFollow: string[],
    expectedSymbols: { name: string; type: SymbolType }[],
  ) {
    const original = Object.assign({}, fsState);
    const volume = Volume.fromJSON(fsState);
    const fs = (createFsFromVolume(volume) as unknown) as RequiredFS;

    const symbols = getExternalSymbols(declarationFiles, dontFollow, fs, '/');

    checkSymbols(symbols, expectedSymbols);
    expect(volume.toJSON()).toStrictEqual(original);
  }

  function testSymbolExtraction(
    declarationContent: string,
    expectedSymbols: { name: string; type: SymbolType }[],
  ) {
    const symbols = findSymbolNames(
      ts.createSourceFile(
        'dummy',
        declarationContent,
        ts.ScriptTarget.ES2015,
        true,
      ),
      new Set(),
      () => {
        throw new Error('Should be self contained');
      },
      () => void 0,
    );
    checkSymbols(symbols, expectedSymbols);
  }

  function checkSymbols(
    symbols: ExternalSymbol[],
    expected: { name: string; type: SymbolType }[],
  ) {
    expect(symbols.map(({ name, type }) => ({ name, type }))).toStrictEqual(
      expected,
    );
  }
});
