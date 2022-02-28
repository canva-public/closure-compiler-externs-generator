import path from 'path';
import fg from 'fast-glob';
import fs from 'fs';
import { generateExterns } from './generate_externs';

export interface Package {
  /** The name of package, e.g. 'react' */
  name: string;
  /** A manual set of declaration file globs, e.g. declarations/**\/*.d.ts
   * default: ['<name>/**\/*.d.ts', '@types/<name>/**\/*.d.ts']
   */
  declarationGlobs?: string[];
}

/**
 * Generates externs for a given set of packages, retrieving the declaration files from their package directories when
 * not specified.
 *
 * Outputs a single extern file for each library with the path <out argument>/<module name>.js.
 */
export function generateExternsForPackages(opts: {
  /** The path to write externs to. */
  outPath: string;
  /** The set of packages to generate externs for. */
  packages: readonly Package[];
  /** The root of packages, e.g. 'node_modules' */
  packageRoot: string;
  fileSystem?: Pick<typeof fs, 'mkdirSync' | 'writeFileSync'>;
  debug?: boolean;
}): void {
  const libraryToDeclarationPaths = getDeclarationPaths(
    opts.packages,
    opts.packageRoot,
  );

  // Collect all declaration paths.
  // Some declaration files import common declaration files, e.g react-dnd imports the react
  // types. We pass the set of all declaration files to getExternalSymbols as don't follow
  // to prevent duplicates, e.g. react-dnd including all the react symbols.
  const allPaths = new Set<string>();
  for (const declarationPaths of libraryToDeclarationPaths.values()) {
    declarationPaths.forEach((p) => allPaths.add(p));
  }

  for (const [identifier, declarationPaths] of libraryToDeclarationPaths) {
    generateExterns({
      outPath: opts.outPath,
      declarationFiles: declarationPaths,
      fileSystem: opts.fileSystem,
      debug: opts.debug,
      ignoreDeclarationFiles: allPaths,
      identifier,
    });
  }
}

/**
 * Returns a map of module identifiers to TS declaration files.
 */
function getDeclarationPaths(
  pkgs: readonly Package[],
  packageRoot: string,
): Map<string, Set<string>> {
  const absRoot = path.resolve(packageRoot);
  return new Map(
    pkgs.map((pkg) => {
      const globs = pkg.declarationGlobs || [
        path.join(absRoot, pkg.name, '**/*.d.ts'),
        path.join(absRoot, '@types', pkg.name, '**/*.d.ts'),
      ];

      const paths = fg.sync(globs, { absolute: true, onlyFiles: true });

      return [moduleNameToIdentifier(pkg.name), new Set(paths)];
    }),
  );
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
