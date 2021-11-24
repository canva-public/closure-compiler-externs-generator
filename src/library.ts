import { resolve, dirname, join } from 'path';
import { types, deprecate } from 'util';

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
 * from https://github.com/microsoft/dts-gen/blob/af84657554e01fcfa81b210a43efd8236f476fd4/lib/index.ts#L23-L26
 * and https://github.com/microsoft/dts-gen/blob/af84657554e01fcfa81b210a43efd8236f476fd4/lib/names.ts#L1-L8
 *
 * Example:
 *  @foo/bar-baz/quux => foo__bar_baz/quux
 */
export function moduleNameToIdentifier(moduleName: string): string {
  let id = moduleName.replace(/-/g, '_');
  if (moduleName.indexOf('@') === 0 && moduleName.indexOf('/') !== -1) {
    // we have a scoped module, e.g. @bla/foo
    // which should be converted to   bla__foo
    id = id.substr(1).replace('/', '__');
  }
  return id;
}

/**
 * Converts a module name to a types module name.
 *
 * Example:
 *  @foo/bar-baz => @types/foo__bar-baz
 */
export function moduleNameToTypesModule(moduleName: string): string | null {
  if (moduleName.startsWith('@')) {
    if (moduleName.startsWith('@types/')) {
      // moduleName refers to a types package
      return null;
    }
    // Scoped module
    return (
      moduleName
        // Replace first slash
        .replace('/', '__')
        // Prefix with @types
        .replace(/^@/, '@types/')
    );
  } else {
    return '@types/' + moduleName;
  }
}

function attemptResolveTypesModule(
  moduleName: string,
  from: string,
): string | null {
  const typedModuleName = moduleNameToTypesModule(moduleName);
  return typedModuleName && attemptResolve(typedModuleName, from);
}

/** @todo FS implementation as param */
export function createApplyDefaults(from: string) {
  return ({
    declarationGlobs,
    ...library
  }: Partial<Library> & { moduleName: string }): Library => ({
    identifier: moduleNameToIdentifier(library.moduleName),
    externImports: [],
    declarationGlobs: [
      attemptResolve(library.moduleName, from),
      attemptResolveTypesModule(library.moduleName, from),
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

function errorWithCode(e: unknown): e is Error & { code: unknown } {
  return types.isNativeError(e) && 'code' in e;
}

function attemptResolve(moduleName: string, from: string): string | null {
  let p: string;
  try {
    p = require.resolve(join(moduleName, 'package.json'), { paths: [from] });
  } catch (e) {
    if (errorWithCode(e) && e.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    /* istanbul ignore next */
    throw e;
  }
  return resolve(`${dirname(p)}/**/*.d.ts`);
}
