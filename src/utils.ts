import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import {
  Entry,
  ClassifiedEntry,
  ResolvedEntry,
  AWSConfig,
  AWSSecretStringData
} from './types';
import * as core from '@actions/core';
import * as path from 'path';
import * as constants from './constants';

/**
 * Validates AWS credentials to ensure all three are provided together or none at all
 * @param accessKeyId - AWS access key ID
 * @param secretAccessKey - AWS secret access key
 * @param sessionToken - AWS session token
 * @throws Error if partial credentials are provided
 */
export function validateAWSCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string
) {
  const providedCreds = [];
  if (accessKeyId.trim()) providedCreds.push('aws_access_key_id');
  if (secretAccessKey.trim()) providedCreds.push('aws_secret_access_key');
  if (sessionToken.trim()) providedCreds.push('aws_session_token');

  if (providedCreds.length > 0 && providedCreds.length < 3) {
    throw new Error(
      `Partial AWS credentials provided: ${providedCreds.join(', ')}. All three credentials must be provided together, or leave all three empty to use scope credentials.`
    );
  }
}

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
 * Get entries from aws secret name references, direct values, and YAML inputs
 *
 * @example
 * Input:
 * awsSecretReferencesInput: '{"SHOPIFY_PRODUCT_VARIANT_ABC": "projectname-dev-shared-shopify-vars"}'
 * jsonInput: '{"AWS_REGION": "ap-northeast-1", "NODE_ENV": "production"}'
 *
 * Output:
 * [
 *   { key: "SHOPIFY_PRODUCT_VARIANT_ABC", value: "projectname-dev-shared-shopify-vars", type: "aws_secret_reference" },
 *   { key: "AWS_REGION", value: "ap-northeast-1", type: "direct_value" },
 *   { key: "NODE_ENV", value: "production", type: "direct_value" }
 * ]
 *
 * @returns array of classified entries
 */
export function extractEntries(
  awsSecretReferencesInput: string, // AWS secret name reference strings (e.g., "projectname-dev-shared-vars")
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
 * Create AWS Secrets Manager client with provided credentials or fall back to scope
 * @param awsConfig - AWS configuration
 * @returns Configured SecretsManagerClient
 */
function createSecretsManagerClient(
  awsConfig: AWSConfig
): SecretsManagerClient {
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

  return new SecretsManagerClient(clientConfig);
}

/**
 * Fetch both ARN and data for a secret name from AWS Secrets Manager
 *
 * @example
 * Input:
 * secretName: "projectname-dev-shared-shopify-vars"
 *
 * Output:
 * {
 *   arn: "arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN",
 *   secretValues: {
 *     "SHOPIFY_PRODUCT_VARIANT_ABC": "19191919191919",
 *     "SHOPIFY_PRODUCT_VARIANT_DEF": "19191919191918"
 *   }
 * }
 *
 * @param client - AWS Secrets Manager client
 * @param secretName - Name of the secret to fetch
 * @returns Object containing both ARN and parsed secret values
 */
async function fetchSecretARNAndData(
  client: SecretsManagerClient,
  secretName: string
): Promise<{
  arn: string;
  secretValues: Record<string, string | number | boolean>;
}> {
  const command = new GetSecretValueCommand({
    SecretId: secretName
  });
  const response = await client.send(command);

  if (!response.ARN) {
    throw new Error(`Secret ${secretName} has no ARN`);
  }

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  const secretValues = JSON.parse(response.SecretString);

  return {
    arn: response.ARN,
    secretValues
  };
}

/**
 * Fetch secrets data from AWS for processing
 *
 * @example
 * Input:
 * secretReferenceEntries: [
 *   { key: "SHOPIFY_PRODUCT_VARIANT_ABC", value: "projectname-dev-shared-shopify-vars", type: "aws_secret_reference" },
 *   { key: "SHOPIFY_PRODUCT_VARIANT_DEF", value: "projectname-dev-shared-shopify-vars", type: "aws_secret_reference" }
 * ]
 *
 * Output:
 * {
 *   arns: {
 *     "projectname-dev-shared-shopify-vars": "arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN"
 *   },
 *   secretValues: {
 *     "projectname-dev-shared-shopify-vars": {
 *       "SHOPIFY_PRODUCT_VARIANT_ABC": "19191919191919",
 *       "SHOPIFY_PRODUCT_VARIANT_DEF": "19191919191918"
 *     }
 *   }
 * }
 *
 * @param secretReferenceEntries
 * - Array of secret name references (entries with type 'aws_secret_reference') only
 * @param awsConfig - AWS configuration
 * @returns Object with ARNs and secret values for formatting
 */
export async function fetchAllSecretsDataFromAWS(
  secretReferenceEntries: ClassifiedEntry[],
  awsConfig: AWSConfig
): Promise<{
  arns: Record<string, string>;
  secretValues: AWSSecretStringData;
}> {
  const client = createSecretsManagerClient(awsConfig);

  // Get unique secret names
  const secretNames = new Set<string>();
  for (const entry of secretReferenceEntries) {
    secretNames.add(String(entry.value));
  }

  const arns: Record<string, string> = {};
  const secretValues: AWSSecretStringData = {};

  // Fetch for each secret
  for (const secretName of secretNames) {
    try {
      const result = await fetchSecretARNAndData(client, secretName);
      arns[secretName] = result.arn;
      secretValues[secretName] = result.secretValues;
    } catch (error) {
      throw new Error(
        `Failed to fetch secret ${secretName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return { arns, secretValues };
}

/**
 * Build resolved entries from secret values for test config generation
 *
 * @example
 * Input:
 * entries: [
 *   { key: "SHOPIFY_PRODUCT_VARIANT_ABC", value: "projectname-dev-shared-shopify-vars", type: "aws_secret_reference" },
 *   { key: "AWS_REGION", value: "ap-northeast-1", type: "direct_value" }
 * ]
 * secretValues: {
 *   "projectname-dev-shared-shopify-vars": {
 *     "SHOPIFY_PRODUCT_VARIANT_ABC": "19191919191919"
 *   }
 * }
 *
 * Output:
 * [
 *   { key: "SHOPIFY_PRODUCT_VARIANT_ABC", resolvedValue: "19191919191919", originalValue: "projectname-dev-shared-shopify-vars", resolutionStatus: "success" },
 *   { key: "AWS_REGION", resolvedValue: "ap-northeast-1", originalValue: "ap-northeast-1", resolutionStatus: "not_required" }
 * ]
 *
 * @param entries - Array of classified entries
 * @param secretValues - Already-fetched secret values from formatter
 * @returns Array of resolved entries with actual values
 */
export function buildResolvedEntriesFromSecretValues(
  entries: ClassifiedEntry[],
  secretValues: AWSSecretStringData
): ResolvedEntry[] {
  const resolvedEntries: ResolvedEntry[] = [];

  for (const entry of entries) {
    if (entry.type === 'aws_secret_reference') {
      const secretName = String(entry.value);
      const secretValuesForSecret = secretValues[secretName];
      const value = secretValuesForSecret?.[entry.key];

      if (value !== undefined) {
        resolvedEntries.push({
          key: entry.key,
          resolvedValue: String(value), // Actual value from AWS
          originalValue: secretName, // Original secret name
          resolutionStatus: 'success'
        });
      } else {
        // Secret key not found in the secret
        core.debug(`Secret key ${entry.key} not found in secret ${secretName}`);
        resolvedEntries.push({
          key: entry.key,
          resolvedValue: secretName, // Fallback to secret name
          originalValue: secretName,
          resolutionStatus: 'failed' // Key not found
        });
      }
    } else {
      // Direct value - no resolution needed
      resolvedEntries.push({
        key: entry.key,
        resolvedValue: String(entry.value),
        originalValue: String(entry.value),
        resolutionStatus: 'not_required'
      });
    }
  }

  return resolvedEntries;
}
