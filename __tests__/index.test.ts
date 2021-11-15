import {
  createApplyDefaults,
  processLibraries,
  FS,
  Library,
} from '../src/index';
import { Volume, createFsFromVolume } from 'memfs';
import { libraries } from './fixtures/libraries';
import * as path from 'path';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function createVolumeAndFs() {
  const volume = new Volume();
  const fs = createFsFromVolume(volume) as FS;

  return {
    fs,
    volume,
  };
}

function snapshotLibraries(
  libraries: Partial<Library> & { moduleName: string }[],
) {
  const tailoredApplyDefaults = createApplyDefaults(fixturesDir);
  const { volume, fs } = createVolumeAndFs();
  processLibraries(
    '/',
    libraries.map(tailoredApplyDefaults),
    false,
    fs,
    fixturesDir,
  );
  expect(volume.toJSON()).toMatchSnapshot();
}

describe('externs-generator', () => {
  describe('generation', () => {
    it.each([false, true])(
      'produces externs for a given set of modules with debug = %s',
      (debug) => {
        expect.hasAssertions();
        const { volume, fs } = createVolumeAndFs();
        processLibraries('/', libraries, debug, fs, fixturesDir);
        expect(volume.toJSON()).toMatchSnapshot();
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
        { moduleName: 'untyped-cjs-and-esm' },
        { moduleName: 'untyped-cjs' },
      ]);
    });
  });
});
