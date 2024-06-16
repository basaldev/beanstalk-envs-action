import * as core from '@actions/core';
import * as path from 'path';
import { Entry } from './types';

import * as constants from './constants';

/**
 * Get entries from process.env or from input.json
 * @returns array of key/values
 */
export function extractEntries(
  jsonInput: string,
  processEnvs: NodeJS.ProcessEnv,
  shouldSort = false,
  shouldFailOnEmpty = false
): Entry[] {
  try {
    const yamlEntries: Entry[] = Object.keys(processEnvs)
      .filter(key => key.startsWith(constants.YAML_ENTRY_PREFIX))
      .map(key => ({ key: extractYamlKey(key), value: processEnvs[key]! }));

    const jsonEntries: Entry[] = Object.entries(JSON.parse(jsonInput)).map(
      ([key, value]) =>
        ({
          key,
          value
        }) as Entry
    );

    const duplicateEntries = findDuplicateEntries(yamlEntries, jsonEntries);
    if (duplicateEntries.length > 0) {
      throw new Error(
        `Duplicate keys detected (${duplicateEntries.join(',')})`
      );
    }

    const entries = [...yamlEntries, ...jsonEntries];

    const emptyEntries = entries.filter(item => !item.value);
    if (shouldFailOnEmpty && emptyEntries.length > 0) {
      throw new Error(
        `Empty entries were found (${emptyEntries.map(entry => entry.key).join(',')})`
      );
    }

    return shouldSort ? sortEntries(entries) : entries;
  } catch (error) {
    error instanceof Error &&
      core.error(`[extractEntries] Error: ${error.message}`);
    return [];
  }
}

/**
 * Remove NodeJS attached meta formatting from process.env variables related to action
 * @param processEnvKey
 * @returns variable key
 */
export function extractYamlKey(processEnvKey: string): string {
  return processEnvKey.split(constants.YAML_ENTRY_PREFIX)[1];
}

/**
 * Calculate sanitized file output path
 * @param directory
 * @param filename
 * @returns path
 */
export function getOutputPath(directory: string, filename: string) {
  if (directory.startsWith('/')) {
    throw new Error(
      'Absolute paths are not allowed. Please use a relative path.'
    );
  }

  const filePath =
    process.env['GITHUB_WORKSPACE'] === 'None'
      ? '.'
      : process.env['GITHUB_WORKSPACE'] || '.';

  return path.join(
    filePath,
    directory.startsWith('./') ? directory.slice(2) : directory,
    filename
  );
}

/**
 * Util to determine if a user has specified duplicate key/values in the json and yaml input
 * @param arr1
 * @param arr2
 * @returns array of duplicate keys
 */
export function findDuplicateEntries(arr1: Entry[], arr2: Entry[]) {
  const keyMap = new Map();
  const duplicates = new Set();

  arr1.forEach(item => {
    keyMap.set(item.key, true);
  });

  arr2.forEach(item => {
    if (keyMap.has(item.key)) {
      duplicates.add(item.key);
    }
  });

  return Array.from(duplicates);
}

/**
 * Sort arrays by key
 * @param array
 * @returns sorted array
 */
export function sortEntries(array: Entry[]) {
  return array.sort((a, b) => {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return 0;
  });
}
