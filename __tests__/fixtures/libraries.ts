import type { Library } from '../../src/library';
import { applyDefaults } from '../../src/library';

const libraryConfigs: (Partial<Library> & { moduleName: string })[] = [
  {
    moduleName: 'react',
  },
];

export const libraries: readonly Library[] = libraryConfigs.map(applyDefaults);
