import { FS } from '../../src/library';
import type { Library } from '../../src/index';
import { createApplyDefaults } from '../../src/index';

export function createLibraries(basePath: string, fs: FS): readonly Library[] {
  const applyDefaults = createApplyDefaults(basePath, fs);

  const libraryConfigs: (Partial<Library> & { moduleName: string })[] = [
    { moduleName: 'main-implicit' },
    { moduleName: 'untyped-cjs' },
  ];

  return libraryConfigs.map(applyDefaults);
}
