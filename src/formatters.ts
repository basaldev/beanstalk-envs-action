import { Entry } from './types';
import { ENVVARS_FILE_HEADER } from './constants';

/**
 * Format data into default envvars.config format
 * @param entries
 * @returns
 */
export function ebextensionsEnvVarsDefaultFormatter(entries: Entry[]): string {
  return entries.reduce((prev, { key, value }) => {
    const name = `  - option_name: ${key}\n`;
    const valueStr = `    value: ${value}\n`;
    return prev + name + valueStr;
  }, ENVVARS_FILE_HEADER);
}
