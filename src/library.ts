import { resolve, join } from 'path';
import { deprecate } from 'util';
import fs from 'fs';

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

export type FS = Pick<typeof fs, 'existsSync'>;

export function createApplyDefaults(from: string, fileSystem: FS = fs) {
  return ({
    declarationGlobs,
    ...library
  }: Partial<Library> & { moduleName: string }): Library => ({
    identifier: moduleNameToIdentifier(library.moduleName),
    externImports: [],
    declarationGlobs: [
      attemptResolve(library.moduleName, from, fileSystem),
      attemptResolve(`@types/${library.moduleName}`, from, fileSystem),
      ...(declarationGlobs || []),
    ].filter((glob): glob is string => !!glob),
    ...library,
  });
}

/** @deprecated */
export const applyDefaults = deprecate(
  createApplyDefaults(__dirname, fs),
  '"applyDefaults" retrieves information relative to the "@canva/closure-compiler-externs-generator" package, incorrect modules may be resolved. Use "createApplyDefaults" instead.',
);

function attemptResolve(
  moduleName: string,
  from: string,
  fileSystem: FS,
): string | null {
  const modulePath = findPackage(from, moduleName, fileSystem);
  if (!modulePath) {
    return null;
  }
  return join(modulePath, '/**/*.d.ts');
}

/**
 * Traverses up file system to find requested package (matching on `node_modules/{moduleName}/`).
 */
function findPackage(
  resolveFrom: string,
  moduleName: string,
  fileSystem: FS,
): string | null {
  let searchPath: string | false = resolveFrom;
  while (searchPath) {
    const proposedModulepath = join(searchPath, 'node_modules', moduleName);
    if (fileSystem.existsSync(proposedModulepath)) {
      return proposedModulepath;
    }
    if (searchPath === resolve('/')) {
      searchPath = false;
    } else {
      searchPath = resolve(searchPath, '..');
    }
  }

  return null;
}
