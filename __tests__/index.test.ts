import {
  createApplyDefaults,
  processLibraries,
  FS as IndexFS,
  Library,
} from '../src/index';
import { Volume, createFsFromVolume } from 'memfs';
import { libraries } from './fixtures/libraries';
import { createNodeModules } from './fixtures/node_modules-fs';
import { FS as LibraryFS } from '../src/library';

function createVolumeAndFs() {
  const volume = Volume.fromJSON(createNodeModules('/'));
  const fileSystem = (createFsFromVolume(volume) as unknown) as IndexFS &
    LibraryFS;

  return {
    fileSystem,
    volume,
  };
}

function snapshotLibraries(
  libraries: Partial<Library> & { moduleName: string }[],
) {
  const { volume, fileSystem } = createVolumeAndFs();
  const tailoredApplyDefaults = createApplyDefaults('/', fileSystem);
  processLibraries(
    '/out',
    libraries.map(tailoredApplyDefaults),
    false,
    fileSystem,
    process.cwd(),
  );
  expect(volume.toJSON()).toMatchSnapshot();
}

describe('externs-generator', () => {
  describe('generation', () => {
    it.each([false, true])(
      'produces externs for a given set of modules with debug = %s',
      (debug) => {
        expect.hasAssertions();
        const { volume, fileSystem } = createVolumeAndFs();
        processLibraries('/out', libraries, debug, fileSystem, process.cwd());
        expect(volume.toJSON()).toMatchSnapshot();
      },
    );

    it('for scoped modules', () => {
      expect.hasAssertions();
      snapshotLibraries([
        { moduleName: '@scoped/exports-sugar-esm' },
        { moduleName: '@scoped/exports-sugarfree-esm' },
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
