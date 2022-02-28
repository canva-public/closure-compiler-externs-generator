import { generateExternsForPackages } from '../src/index';
import { Volume, createFsFromVolume, DirectoryJSON } from 'memfs';
import * as path from 'path';
import fs from 'fs';

const fixturesDir = path.resolve(__dirname, '..');
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

describe('externs-generator with react', () => {
  it('without debug', () => {
    expect.hasAssertions();
    const { volume, fs } = createVolumeAndFs();
    generateExternsForPackages({
      outPath: path.join(fixturesDir, 'out'),
      packages: [{ name: 'react' }],
      fileSystem: fs,
      packageRoot: path.join(fixturesDir, 'node_modules'),
    });
    expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
  });

  it('with debug', () => {
    expect.hasAssertions();
    const { volume, fs } = createVolumeAndFs();
    generateExternsForPackages({
      outPath: path.join(fixturesDir, 'out'),
      packages: [{ name: 'react' }],
      debug: true,
      fileSystem: fs,
      packageRoot: path.join(fixturesDir, 'node_modules'),
    });
    expect(normaliseVolumeSnapshot(volume.toJSON())).toMatchSnapshot();
  });
});
