import debug from 'debug';

// @ts-expect-error pkinfo does not come with type defs and output is variable
import * as pkginfo from 'pkginfo';
const { name } = pkginfo.read(module).package;

const logger = debug(name);

export const warn = logger.extend('warn');
warn.log = console.warn.bind(console);
