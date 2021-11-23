import {
  createApplyDefaults,
  processLibraries,
  FS,
  Library,
} from '../src/index';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import { libraries } from './fixtures/libraries';
import * as path from 'path';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function createVolumeAndFs() {
  const volume = new Volume();
  const fs = (createFsFromVolume(volume) as unknown) as FS;

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

function snapshotLibraries(
  libraries: Partial<Library> & { moduleName: string }[],
) {
  const tailoredApplyDefaults = createApplyDefaults(fixturesDir);
  const { volume, fs } = createVolumeAndFs();
  processLibraries(
    path.join(fixturesDir, 'out'),
    libraries.map(tailoredApplyDefaults),
    false,
    fs,
  );
  expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
}

describe('externs-generator', () => {
  describe('generation', () => {
    it.each([false, true])(
      'produces externs for a given set of modules with debug = %s',
      (debug) => {
        expect.hasAssertions();
        const { volume, fs } = createVolumeAndFs();
        processLibraries(path.join(fixturesDir, 'out'), libraries, debug, fs);
        expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
      },
    );

    it('for scoped modules', () => {
      expect.hasAssertions();
      snapshotLibraries([
        { moduleName: '@scoped/exports-sugar-esm' },
        { moduleName: 'cjs-named-exports' },
        { moduleName: 'main-implicit' },
        { moduleName: 'untyped-cjs-and-esm' },
        { moduleName: 'untyped-cjs' },
      ]);
    });

    it('for various single-export modules', () => {
      expect.hasAssertions();
      snapshotLibraries([
        { moduleName: 'cjs-named-exports' },
        { moduleName: 'main-implicit' },
        { moduleName: 'typings-synonym' },
        { moduleName: 'untyped-cjs-and-esm' },
        { moduleName: 'untyped-cjs' },
      ]);
    });
  });
});
