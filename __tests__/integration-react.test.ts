import { createApplyDefaults, processLibraries, FS } from '../src/index';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import * as path from 'path';

const fixturesDir = path.resolve(__dirname, '..');

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

describe('externs-generator with react', () => {
  it('without debug', () => {
    expect.hasAssertions();
    const tailoredApplyDefaults = createApplyDefaults(fixturesDir);
    const { volume, fs } = createVolumeAndFs();
    processLibraries(
      path.join(fixturesDir, 'out'),
      [{ moduleName: 'react' }].map(tailoredApplyDefaults),
      false,
      fs,
    );
    expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
  });

  it('with debug', () => {
    expect.hasAssertions();
    const tailoredApplyDefaults = createApplyDefaults(fixturesDir);
    const { volume, fs } = createVolumeAndFs();
    processLibraries(
      path.join(fixturesDir, 'out'),
      [{ moduleName: 'react' }].map(tailoredApplyDefaults),
      true,
      fs,
    );
    expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
  });
});
