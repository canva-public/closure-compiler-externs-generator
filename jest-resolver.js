// Temporary workaround while we wait for https://github.com/facebook/jest/issues/9771
// Copied from https://github.com/facebook/jest/issues/9771#issuecomment-974750103
// eslint-disable-next-line @typescript-eslint/no-var-requires
const enhancedResolve = require('enhanced-resolve');

const importResolver = enhancedResolve.create.sync({
  conditionNames: ['import', 'node', 'default'],
  extensions: ['.js', '.json', '.node', '.ts'],
});
const requireResolver = enhancedResolve.create.sync({
  conditionNames: ['require', 'node', 'default'],
  extensions: ['.js', '.json', '.node', '.ts'],
});

module.exports = function (request, options) {
  let resolver = requireResolver;
  if (options.conditions?.includes('import')) {
    resolver = importResolver;
  }
  return resolver(options.basedir, request);
};
