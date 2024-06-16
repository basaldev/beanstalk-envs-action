import * as core from '@actions/core';
import * as fs from 'fs';

import { extractEntries, getOutputPath } from './utils';
import { ebextensionsEnvVarsDefaultFormatter } from './formatters';

export async function run() {
  try {
    const directory = core.getInput('directory') || '.ebextensions';
    const fileName = core.getInput('filename') || 'envvars.config';
    const jsonInput = core.getInput('json') || '{}';
    const outputPath = getOutputPath(directory, fileName);
    const shouldSort = core.getInput('sort_keys') || 'false';
    const shouldFailOnEmpty = core.getInput('fail_on_empty');

    const entries = extractEntries(
      jsonInput,
      process.env,
      Boolean(shouldSort),
      Boolean(shouldFailOnEmpty)
    );
    if (entries.length < 1) throw new Error('No valid entries were found');

    const output = ebextensionsEnvVarsDefaultFormatter(entries);

    core.debug(`Creating file: ${outputPath}`);
    core.setOutput('result', output);
    fs.writeFileSync(outputPath, output);
  } catch (error) {
    if (error instanceof Error) {
      core.debug(`[main] Error: ${error.message}`);
      core.setFailed(`[main] Error: ${error.message}`);
    }
  }
}
