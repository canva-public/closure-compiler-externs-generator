import { applyDefaults, processLibraries, FS } from '../src/index';
import { Volume, createFsFromVolume } from 'memfs';
import { libraries } from './fixtures/libraries';

function createVolumeAndFs() {
  const volume = new Volume();
  const fs = createFsFromVolume(volume) as FS;

  return {
    fs,
    volume,
  };
}

describe('externs-generator', () => {
  describe('generation', () => {
    it.each([false, true])(
      'produces externs for a given set of modules with debug = %s',
      (debug) => {
        expect.hasAssertions();
        const { volume, fs } = createVolumeAndFs();
        processLibraries('/', libraries, debug, fs);
        expect(volume.toJSON()).toMatchSnapshot();
      },
    );

    it('for scoped modules', () => {
      expect.hasAssertions();
      const { volume, fs } = createVolumeAndFs();
      processLibraries(
        '/',
        [
          {
            moduleName: '@sindresorhus/slugify',
          },
        ].map(applyDefaults),
        false,
        fs,
      );
      expect(volume.toJSON()).toMatchSnapshot();
    });
  });
});
