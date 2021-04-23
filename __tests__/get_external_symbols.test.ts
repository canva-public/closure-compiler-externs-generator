// Copyright 2021 Canva Inc. All Rights Reserved.

import type { ExternalSymbol } from '../src/get_external_symbols';
import { getExternalSymbols, SymbolType } from '../src/get_external_symbols';

describe('getExternalSymbols', () => {
  it('follows imports', () => {
    expect.hasAssertions();
    const files: { [key: string]: string } = {
      '/src/entry.d.ts': 'import "./foo"',
      '/src/foo.d.ts': 'declare const foo: string;',
    };

    const readFileSync = (path: string) => files[path];
    const resolveModule = jest.fn().mockReturnValue('/src/foo.d.ts');

    const symbols = getExternalSymbols(
      ['/src/entry.d.ts'],
      [],
      readFileSync,
      resolveModule,
    );

    checkSymbols(symbols, [{ name: 'foo', type: SymbolType.DECLARATION }]);
    expect(resolveModule).toHaveBeenCalledWith('./foo', '/src/entry.d.ts');
  });

  it('follows exports with module specifiers', () => {
    expect.hasAssertions();
    const files: { [key: string]: string } = {
      '/src/entry.d.ts': 'export { default } from "./foo"',
      '/src/foo.d.ts': 'declare const foo: string;',
    };

    const readFileSync = (path: string) => files[path];
    const resolveModule = jest.fn().mockReturnValue('/src/foo.d.ts');

    const symbols = getExternalSymbols(
      ['/src/entry.d.ts'],
      [],
      readFileSync,
      resolveModule,
    );
    checkSymbols(symbols, [{ name: 'foo', type: SymbolType.DECLARATION }]);
    expect(resolveModule).toHaveBeenCalledWith('./foo', '/src/entry.d.ts');
  });

  it('follows file references', () => {
    expect.hasAssertions();
    const files: { [key: string]: string } = {
      '/src/entry.d.ts': '/// <reference path="sub/ref.entry.d.ts" />',
      '/src/sub/ref.entry.d.ts': 'declare const foo: string;',
    };

    const readFileSync = (path: string) => files[path];

    const symbols = getExternalSymbols(
      ['/src/entry.d.ts'],
      [],
      readFileSync,
      () => void 0,
    );
    checkSymbols(symbols, [{ name: 'foo', type: SymbolType.DECLARATION }]);
  });

  it('does not follow file references that in the dontFollow list', () => {
    expect.hasAssertions();
    const files: { [key: string]: string } = {
      '/src/entry.d.ts': '/// <reference path="sub/ref.entry.d.ts" />',
      '/src/sub/ref.entry.d.ts': 'declare const foo: string;',
    };

    const readFileSync = (path: string) => files[path];

    const symbols = getExternalSymbols(
      ['/src/entry.d.ts'],
      ['/src/sub/ref.entry.d.ts'],
      readFileSync,
      () => void 0,
    );
    checkSymbols(symbols, []);
  });

  it('gets properties from an interface', () => {
    expect.hasAssertions();
    runWithMockFs(
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
    runWithMockFs(
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
    runWithMockFs(
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
    runWithMockFs(
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
    runWithMockFs('declare module Module { }', []);
  });

  it('gets properties and declarations from namespaces', () => {
    expect.hasAssertions();
    runWithMockFs(
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
    runWithMockFs(
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
    runWithMockFs(
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
    runWithMockFs(
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

  function runWithMockFs(
    declarationContent: string,
    expectedSymbols: { name: string; type: SymbolType }[],
  ) {
    const symbols = getExternalSymbols(
      ['dummy'],
      [],
      () => declarationContent,
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
