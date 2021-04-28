import type { Library } from '../../src/index';
import { applyDefaults } from '../../src/index';

const libraryConfigs: (Partial<Library> & { moduleName: string })[] = [
  {
    moduleName: 'react',
  },
];

export const libraries: readonly Library[] = libraryConfigs.map(applyDefaults);
