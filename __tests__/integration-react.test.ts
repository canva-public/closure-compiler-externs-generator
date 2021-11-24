import { createApplyDefaults, processLibraries, FS } from '../src/index';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import * as path from 'path';
import fs from 'fs';

const fixturesDir = path.resolve(__dirname, '..');

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

describe('externs-generator with react', () => {
  it('without debug', () => {
    expect.hasAssertions();
    const tailoredApplyDefaults = createApplyDefaults(fixturesDir);
    const { volume, fileSystem } = createVolumeAndFs();
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
    const tailoredApplyDefaults = createApplyDefaults(fixturesDir);
    const { volume, fileSystem } = createVolumeAndFs();
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
