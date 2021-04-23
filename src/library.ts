import { existsSync } from 'fs';
import { resolve, dirname, join } from 'path';

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

export class ExternImportError extends Error {
  constructor(externImport: string, libraryModuleName: string) {
    super(
      `extern import ${externImport} for library ${libraryModuleName} does not exist.`,
    );
  }
}

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

export function applyDefaults({
  declarationGlobs,
  ...library
}: Partial<Library> & { moduleName: string }): Library {
  for (const externImport of library.externImports || []) {
    if (!existsSync(externImport)) {
      throw new ExternImportError(externImport, library.moduleName);
    }
  }
  return {
    identifier: moduleNameToIdentifier(library.moduleName),
    externImports: [],
    declarationGlobs: [
      attemptResolve(library.moduleName),
      attemptResolve(`@types/${library.moduleName}`),
      ...(declarationGlobs || []),
    ].filter((glob): glob is string => !!glob),
    ...library,
  };
}

function attemptResolve(moduleName: string): string | null {
  let p: string;
  try {
    p = require.resolve(join(moduleName, 'package.json'));
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    /* istanbul ignore next */
    throw e;
  }
  return resolve(`${dirname(p)}/**/*.d.ts`);
}
