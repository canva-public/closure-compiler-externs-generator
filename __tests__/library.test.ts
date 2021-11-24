import {
  moduleNameToIdentifier,
  moduleNameToTypesModule,
} from '../src/library';

describe('moduleNameToIdentifier', () => {
  it.each([
    ['@foo/bar-baz/quux', 'foo__bar_baz/quux'],
    ['bar/foo-bar', 'bar/foo_bar'],
    ['foobar', 'foobar'],
  ])('converts %s to %ss', (input, expected) => {
    expect.hasAssertions();
    expect(moduleNameToIdentifier(input)).toBe(expected);
  });
});

describe('moduleNameToTypesModule', () => {
  it.each([
    ['@foo/bar-baz', '@types/foo__bar-baz'],
    ['bar', '@types/bar'],
    ['@types/foobar', null],
  ])('converts %s to %ss', (input, expected) => {
    expect.hasAssertions();
    expect(moduleNameToTypesModule(input)).toBe(expected);
  });
});
