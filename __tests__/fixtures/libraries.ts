import type { Library } from '../../src/index';
import { createApplyDefaults } from '../../src/index';

const applyDefaults = createApplyDefaults(__dirname);

const libraryConfigs: (Partial<Library> & { moduleName: string })[] = [
  { moduleName: 'main-implicit' },
  { moduleName: 'untyped-cjs' },
];

export const libraries: readonly Library[] = libraryConfigs.map(applyDefaults);
