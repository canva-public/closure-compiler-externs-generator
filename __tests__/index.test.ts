import { generateExternsForPackages, Package } from '../src/packages';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import * as path from 'path';
import fs from 'fs';

const packages: readonly Package[] = [
  { name: 'main-implicit' },
  { name: 'untyped-cjs' },
];

const fixturesDir = path.resolve(__dirname, 'fixtures');

type FS = Pick<typeof fs, 'mkdirSync' | 'writeFileSync'>;

function createVolumeAndFs() {
  const volume = new Volume();
  const fs = createFsFromVolume(volume) as FS;

  return {
    fs,
    volume,
  };
}

function normaliseVolumeSnapshot(directoryJSON: DirectoryJSON): DirectoryJSON {
  const newDirectoryJSON: DirectoryJSON = {};

  for (let filePath in directoryJSON) {
    const content = directoryJSON[filePath];
    if (filePath.startsWith(fixturesDir)) {
      filePath = '/' + path.relative(fixturesDir, filePath);
    }
    newDirectoryJSON[filePath] = content;
  }

  return newDirectoryJSON;
}

function snapshotLibraries(packages: Package[]) {
  const { volume, fs } = createVolumeAndFs();
  generateExternsForPackages({
    outPath: path.join(fixturesDir, 'out'),
    packages: packages,
    debug: false,
    fileSystem: fs,
    packageRoot: path.join(fixturesDir, 'node_modules'),
  });
  expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
}

describe('externs-generator', () => {
  describe('generation', () => {
    it.each([false, true])(
      'produces externs for a given set of modules with debug = %s',
      (debug) => {
        expect.hasAssertions();
        const { volume, fs } = createVolumeAndFs();
        generateExternsForPackages({
          outPath: path.join(fixturesDir, 'out'),
          packages,
          debug,
          fileSystem: fs,
          packageRoot: path.join(fixturesDir, 'node_modules'),
        });
        expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
      },
    );

    it('for scoped modules', () => {
      expect.hasAssertions();
      snapshotLibraries([
        { name: '@scoped/exports-sugar-esm' },
        { name: 'cjs-named-exports' },
        { name: 'main-implicit' },
        { name: 'untyped-cjs-and-esm' },
        { name: 'untyped-cjs' },
      ]);
    });

    it('for various single-export modules', () => {
      expect.hasAssertions();
      snapshotLibraries([
        { name: 'cjs-named-exports' },
        { name: 'main-implicit' },
        { name: 'typings-synonym' },
        { name: 'untyped-cjs-and-esm' },
        { name: 'untyped-cjs' },
      ]);
    });
  });
});
