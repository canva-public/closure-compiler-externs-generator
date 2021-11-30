import { resolve, join } from 'path';
import { deprecate } from 'util';
import fs from 'fs';

export type Library = {
  // The name used to import the module.
  moduleName: string;
  // Add an identifier which is safe to use as a filename.
  identifier: string;
  /**
   * @deprecated This property is vestigial, in the same way an Emu has wings but cannot fly.
   * In another place and time it instructed a Closure Compiler plugin for Webpack to load
   * additional externs for this library.
   */
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
 *  `@foo/bar-baz/quux => foo__bar_baz/quux`
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
 *  `@foo/bar-baz => @types/foo__bar-baz`
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
  fileSystem: FS,
): string | null {
  const typedModuleName = moduleNameToTypesModule(moduleName);
  return typedModuleName && attemptResolve(typedModuleName, from, fileSystem);
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
      attemptResolveTypesModule(library.moduleName, from, fileSystem),
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
 * Traverses up file system from specified path to find package.
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
