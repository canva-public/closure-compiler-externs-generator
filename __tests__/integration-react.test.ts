import {
  createApplyDefaults,
  processLibraries,
  FS as IndexFS,
} from '../src/index';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import * as path from 'path';
import fs from 'fs';
import { FS as LibraryFS } from '../src/library';

const fixturesDir = path.resolve(__dirname, '..');

type FSFunc = (path: string, ...arg: unknown[]) => unknown;

function createVolumeAndFs() {
  const volume = new Volume();
  const fileSystem = new Proxy(
    (createFsFromVolume(volume) as unknown) as IndexFS & LibraryFS,
    {
      get(target, prop: keyof (IndexFS & LibraryFS)) {
        if (prop === 'mkdirSync' || prop === 'writeFileSync') {
          return target[prop];
        }
        return (itemPath: string, ...args: unknown[]) => {
          let impl: FSFunc;
          if (itemPath.startsWith(path.join(fixturesDir, 'node_modules'))) {
            impl = (fs[prop] as unknown) as FSFunc;
          } else {
            impl = (target[prop] as unknown) as FSFunc;
          }
          return impl(itemPath, ...args);
        };
      },
    },
  );

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

describe('externs-generator with react', () => {
  it('without debug', () => {
    expect.hasAssertions();
    const { volume, fileSystem } = createVolumeAndFs();
    const tailoredApplyDefaults = createApplyDefaults(fixturesDir, fileSystem);
    processLibraries(
      path.join(fixturesDir, 'out'),
      [{ moduleName: 'react' }].map(tailoredApplyDefaults),
      false,
      fileSystem,
      process.cwd(),
    );
    expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
  });

  it('with debug', () => {
    expect.hasAssertions();
    const { volume, fileSystem } = createVolumeAndFs();
    const tailoredApplyDefaults = createApplyDefaults(fixturesDir, fileSystem);
    processLibraries(
      path.join(fixturesDir, 'out'),
      [{ moduleName: 'react' }].map(tailoredApplyDefaults),
      true,
      fileSystem,
      process.cwd(),
    );
    expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
  });
});
