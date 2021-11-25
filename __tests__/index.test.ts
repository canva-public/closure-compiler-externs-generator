import {
  createApplyDefaults,
  processLibraries,
  FS,
  Library,
} from '../src/index';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import { libraries } from './fixtures/libraries';
import * as path from 'path';
import fs from 'fs';

const fixturesDir = path.resolve(__dirname, 'fixtures');

function createVolumeAndFs() {
  const volume = new Volume();
  const fileSystem = new Proxy((createFsFromVolume(volume) as unknown) as FS, {
    get(target, prop: keyof FS) {
      if (['mkdirSync', 'writeFileSync'].includes(prop)) {
        return target[prop];
      }
      return (itemPath: string, ...args: unknown[]) => {
        if (itemPath.startsWith(path.join(fixturesDir, 'node_modules'))) {
          // @ts-expect-error types are pain
          return fs[prop](itemPath, ...args);
        } else {
          // @ts-expect-error types are pain
          target[prop](itemPath, ...args);
        }
      };
    },
  });

  return {
    fileSystem,
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
  const { volume, fileSystem } = createVolumeAndFs();
  processLibraries(
    path.join(fixturesDir, 'out'),
    libraries.map(tailoredApplyDefaults),
    false,
    fileSystem,
    process.cwd(),
  );
  expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
}

describe('externs-generator', () => {
  describe('generation', () => {
    it.each([false, true])(
      'produces externs for a given set of modules with debug = %s',
      (debug) => {
        expect.hasAssertions();
        const { volume, fileSystem } = createVolumeAndFs();
        processLibraries(
          path.join(fixturesDir, 'out'),
          libraries,
          debug,
          fileSystem,
          process.cwd(),
        );
        expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
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
