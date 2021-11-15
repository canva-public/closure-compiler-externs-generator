import { resolve, dirname, join } from 'path';
import { deprecate } from 'util';

export type Library = {
  // The name used to import the module.
  moduleName: string;
  // Add an identifier which is safe to use as a filename.
  identifier: string;
  // Modules that should force externs for this library to be loaded
  externImports: readonly string[];
  // TypeScript type declaration files.
  // Will always include node_modules/${library.moduleName} and
  // node_modules/@types/${library.moduleName}, but additional can be specified.
  declarationGlobs: readonly string[];
};

/**
 * Generates a unique and file safe name from a module name.
 * from https://github.com/Microsoft/dts-gen/commit/cda239f132146fe8965959d60f6bd40d115ba0aa
 *
 * Example:
 *  @foo/bar-baz/quux.ts => foo__bar_baz__quux.ts
 */
function moduleNameToIdentifier(s: string): string {
  let ret = s.replace(/-/g, '_');
  if (s.indexOf('@') === 0 && s.indexOf('/') !== -1) {
    // we have a scoped module, e.g. @bla/foo
    // which should be converted to   bla__foo
    ret = ret.substr(1).replace('/', '__');
  }
  return ret;
}

export function createApplyDefaults(from: string) {
  return ({
    declarationGlobs,
    ...library
  }: Partial<Library> & { moduleName: string }): Library => ({
    identifier: moduleNameToIdentifier(library.moduleName),
    externImports: [],
    declarationGlobs: [
      attemptResolve(library.moduleName, from),
      attemptResolve(`@types/${library.moduleName}`, from),
      ...(declarationGlobs || []),
    ].filter((glob): glob is string => !!glob),
    ...library,
  });
}

/** @deprecated */
export const applyDefaults = deprecate(
  createApplyDefaults(__dirname),
  '"applyDefaults" retrieves information relative to the "@canva/closure-compiler-externs-generator" package, incorrect modules may be resolved. Use "createApplyDefaults" instead.',
);

function attemptResolve(moduleName: string, from: string): string | null {
  let p: string;
  try {
    p = require.resolve(join(moduleName, 'package.json'), { paths: [from] });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    /* istanbul ignore next */
    throw e;
  }
  return resolve(`${dirname(p)}/**/*.d.ts`);
}
