import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import {
  Entry,
  ClassifiedEntry,
  ResolvedEntry,
  AWSConfig,
  SecretGroups
} from './types';
import * as core from '@actions/core';
import * as path from 'path';
import * as constants from './constants';

/**
 * Get entries from process.env or from input.json (default format - direct values)
 * @returns array of key/values
 */
export function extractEntriesDefault(
  jsonInput: string, // direct values entries
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

    const entries = [...yamlEntries, ...jsonEntries];
    const duplicateEntries = findDuplicateEntries(entries);
    if (duplicateEntries.length > 0) {
      throw new Error(
        `Duplicate keys detected (${duplicateEntries.join(',')})`
      );
    }

    const emptyEntries = entries.filter(item => !item.value);
    if (shouldFailOnEmpty && emptyEntries.length > 0) {
      throw new Error(
        `Empty entries were found (${emptyEntries.map(entry => entry.key).join(',')})`
      );
    }

    return shouldSort ? sortEntries(entries) : entries;
  } catch (error) {
    error instanceof Error &&
      core.error(`[extractEntriesDefault] Error: ${error.message}`);
    return [];
  }
}

/**
 * Get entries from aws secrets partial references, direct values, and YAML inputs
 * @returns array of classified entries
 */
export function extractEntries(
  awsSecretReferencesInput: string, // AWS secret reference strings (e.g., "projectname-dev-shared-vars:APP_ENVIRONMENT")
  jsonInput: string, // direct values entries
  processEnvs: NodeJS.ProcessEnv,
  shouldSort = false,
  shouldFailOnEmpty = false
): ClassifiedEntry[] {
  try {
    const secretsEntries: ClassifiedEntry[] = Object.entries(
      JSON.parse(awsSecretReferencesInput)
    ).map(([key, value]) => ({
      key,
      value: value as string | boolean | number,
      type: 'aws_secret_reference'
    }));

    const directEntries: ClassifiedEntry[] = Object.entries(
      JSON.parse(jsonInput)
    ).map(([key, value]) => ({
      key,
      value: value as string | boolean | number,
      type: 'direct_value'
    }));

    const yamlEntries: ClassifiedEntry[] = Object.keys(processEnvs)
      .filter(key => key.startsWith(constants.YAML_ENTRY_PREFIX))
      .map(key => ({
        key: extractYamlKey(key),
        value: processEnvs[key]!,
        type: 'direct_value'
      }));

    const allEntries = [...secretsEntries, ...directEntries, ...yamlEntries];
    const duplicateEntries = findDuplicateEntries(allEntries);
    if (duplicateEntries.length > 0) {
      throw new Error(
        `Duplicate keys detected (${duplicateEntries.join(',')})`
      );
    }

    const emptyEntries = allEntries.filter(item => !item.value);
    if (shouldFailOnEmpty && emptyEntries.length > 0) {
      throw new Error(
        `Empty entries were found (${emptyEntries.map(entry => entry.key).join(',')})`
      );
    }

    return shouldSort ? sortEntries(allEntries) : allEntries;
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
 * Find duplicate keys in entries array
 * @param entries - Array of entries to check
 * @returns Array of duplicate keys found
 */
export function findDuplicateEntries(entries: Entry[] | ClassifiedEntry[]) {
  const keyMap = new Map<string, boolean>();
  const duplicates = new Set<string>();

  entries.forEach(item => {
    if (keyMap.has(item.key)) {
      duplicates.add(item.key);
    } else {
      keyMap.set(item.key, true);
    }
  });

  return Array.from(duplicates);
}

/**
 * Sort arrays by key
 * @param array
 * @returns sorted array
 */
export function sortEntries<T extends Entry | ClassifiedEntry>(
  array: T[]
): T[] {
  return array.sort((a, b) => {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return 0;
  });
}

/**
 * Resolve AWS Secrets Manager references to actual values
 * Make AWS API call per secret name
 *
 * @example
 * Input entries:
 * [
 *   { key: "APP_ENV", value: "projectname-dev-shared-vars:APP_ENVIRONMENT", type: "aws_secret_reference" },
 *   { key: "CUSTOM_SHOPIFY_STORE_DOMAIN", value: "projectname-dev-shared-shopify-vars:SHOPIFY_STORE_CUSTOM_DOMAIN", type: "aws_secret_reference" },
 *   { key: "AWS_REGION", value: "ap-northeast-1", type: "direct_value" }  // Direct value
 * ]
 *
 * Output resolved entries:
 * [
 *   { key: "APP_ENV", resolvedValue: "dev", resolutionStatus: "success" },
 *   { key: "CUSTOM_SHOPIFY_STORE_DOMAIN", resolvedValue: "dev-myshop.summercorp.co.jp", resolutionStatus: "success" },
 *   { key: "AWS_REGION", resolvedValue: "ap-northeast-1", resolutionStatus: "not_required" }
 * ]
 *
 * @param entries - Array of classified entries with explicit types
 * @param awsConfig - AWS configuration
 * @returns Array of resolved entries with actual values
 */
export async function resolvePartialReferencesToValues(
  entries: ClassifiedEntry[],
  awsConfig: AWSConfig
): Promise<ResolvedEntry[]> {
  // Create AWS client with provided credentials or fall back to scope
  const clientConfig: {
    region: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
  } = { region: awsConfig.region };

  if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
      sessionToken: awsConfig.sessionToken
    };
  }

  const client = new SecretsManagerClient(clientConfig);
  const resolvedEntries: ResolvedEntry[] = [];

  // Group entries by secret name
  // Example: { "projectname-dev-shared-vars": [SecretEntry1, SecretEntry2], "projectname-dev-shared-shopify-vars": [SecretEntry3] }
  const secretGroups: SecretGroups = {};

  // Categorize and group entries by type
  // aws_secret_reference or direct_value
  for (const entry of entries) {
    if (entry.type === 'aws_secret_reference') {
      const secretReferenceString = String(entry.value);
      const [secretName, secretKey] = secretReferenceString.split(':');

      // Initialize array for this secret name if it doesn't exist
      if (!secretGroups[secretName]) {
        secretGroups[secretName] = [];
      }

      // Add to the group for this secret name
      secretGroups[secretName].push({
        key: entry.key, // Environment variable name (e.g., "APP_ENV")
        secretKey, // Key to look up in AWS secret (e.g., "APP_ENVIRONMENT")
        originalValue: secretReferenceString // Original reference string (e.g., "projectname-dev-shared-vars:APP_ENVIRONMENT")
      });
    } else {
      // Direct value - no resolution needed, add directly to resolved entries
      resolvedEntries.push({
        key: entry.key,
        resolvedValue: String(entry.value),
        originalValue: String(entry.value),
        resolutionStatus: 'not_required'
      });
    }
  }

  // Resolve secrets by making API call per secret name
  const secretNames = Object.keys(secretGroups);
  for (let secretIndex = 0; secretIndex < secretNames.length; secretIndex++) {
    const secretName = secretNames[secretIndex];
    const secretEntries = secretGroups[secretName];

    try {
      core.debug(
        `Resolving secret ${secretName} for ${secretEntries.length} keys...`
      );

      // API call for current secret name
      // Example: get all keys for secretName = "projectname-dev-shared-vars"
      const secretData = await fetchSecretData(client, secretName);

      // Extract all requested keys from the same secret response
      for (
        let entryIndex = 0;
        entryIndex < secretEntries.length;
        entryIndex++
      ) {
        const entry = secretEntries[entryIndex];
        const value = secretData[entry.secretKey];

        if (value !== undefined) {
          resolvedEntries.push({
            key: entry.key,
            resolvedValue: String(value), // Actual value from AWS (e.g., "dev")
            originalValue: entry.originalValue, // Original reference string (e.g., "projectname-dev-shared-vars:APP_ENVIRONMENT")
            resolutionStatus: 'success' // Resolution success
          });
          core.debug(
            `Resolved ${entry.key}: ${entry.originalValue} -> [RESOLVED]`
          );
        } else {
          // Secret key not found in the secret
          core.debug(
            `Secret key ${entry.secretKey} not found in secret ${secretName} for entry ${entry.key}`
          );
          resolvedEntries.push({
            key: entry.key,
            resolvedValue: entry.originalValue, // Fallback to original reference
            originalValue: entry.originalValue,
            resolutionStatus: 'failed' // Key not found
          });
        }
      }
    } catch (error) {
      // AWS API call failed in general
      core.debug(
        `Failed to resolve secret ${secretName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Fall back to original values for all entries in this secret
      for (
        let entryIndex = 0;
        entryIndex < secretEntries.length;
        entryIndex++
      ) {
        const entry = secretEntries[entryIndex];
        resolvedEntries.push({
          key: entry.key,
          resolvedValue: entry.originalValue, // Fallback to original reference
          originalValue: entry.originalValue,
          resolutionStatus: 'failed' // API call failed
        });
      }
    }
  }

  return resolvedEntries;
}

/**
 * Fetch secret data from AWS Secrets Manager
 * -one call per secret name
 *
 * @example
 * Input: secretName = "projectname-dev-shared-vars"
 * Output: { "APP_ENVIRONMENT": "dev", "AUTH_SERVICE_ENDPOINT_PREFIX": "/auth-api", ... }
 *
 * @param client - AWS Secrets Manager client
 * @param secretName - Name of the secret to fetch
 * @returns Parsed secret data object with key-value pairs
 */
async function fetchSecretData(
  client: SecretsManagerClient,
  secretName: string
): Promise<Record<string, string | number | boolean>> {
  const command = new GetSecretValueCommand({
    SecretId: secretName
  });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  // Parse the secret JSON string into a JavaScript object
  // Example: '{"AUTH_SERVICE_ENDPOINT_PREFIX":"/auth-api","APP_ENVIRONMENT":"dev",...}'
  // becomes: { AUTH_SERVICE_ENDPOINT_PREFIX: "/auth-api", APP_ENVIRONMENT: "dev", ... }
  const secretData = JSON.parse(response.SecretString);
  return secretData;
}
