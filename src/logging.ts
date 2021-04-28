import debug from 'debug';
import packageJson from '../package.json';

const logger = debug(packageJson.name);

export const warn = logger.extend('warn');
warn.log = console.warn.bind(console);
