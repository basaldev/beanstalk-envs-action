import * as core from '@actions/core';
import * as fs from 'fs';

import {
  extractEntriesDefault,
  extractEntries,
  getOutputPath,
  buildResolvedEntriesFromSecretValues,
  validateAWSCredentials,
  fetchAllSecretsDataFromAWS
} from './utils';
import {
  ebextensionsEnvVarsSecretManagerFormatter,
  ebextensionsEnvVarsDefaultFormatter
} from './formatters';
import {
  Entry,
  ClassifiedEntry,
  AWSConfig,
  AWSSecretStringData
} from './types';

/**
 *
 * @example
 * Input:
 * aws_secret_references: '{"SHOPIFY_PRODUCT_VARIANT_ABC": "projectname-dev-shared-shopify-vars"}'
 * json: '{"AWS_REGION": "ap-northeast-1"}'
 * aws_region: "ap-northeast-1"
 * rendered_file_path: "."
 *
 * Process:
 * 1. Extract and classify entries (aws secret name references + direct values)
 * 2. Fetch secrets from AWS (get ARNs and values)
 * 3. Generate deployment config (with ARN references)
 * 4. Generate test config (with resolved values)
 *
 * Output files:
 * - .ebextensions/envvars.config (deployment - with ARNs)
 * - .ebextensions/envvars-test.config (testing - with actual values)
 */
export async function run() {
  try {
    const directory = core.getInput('directory') || '.ebextensions';
    const fileName = core.getInput('filename') || 'envvars.config';
    const jsonInput = core.getInput('json') || '{}';
    const awsSecretReferencesInput =
      core.getInput('aws_secret_references') || '';
    const outputPath = getOutputPath(directory, fileName);
    const shouldSort = core.getInput('sort_keys') || 'false';
    const shouldFailOnEmpty = core.getInput('fail_on_empty');
    const renderedFilePath = core.getInput('rendered_file_path') || '';
    const awsRegion = core.getInput('aws_region');
    const awsAccessKeyId = core.getInput('aws_access_key_id') || '';
    const awsSecretAccessKey = core.getInput('aws_secret_access_key') || '';
    const awsSessionToken = core.getInput('aws_session_token') || '';

    // entries can be either:

    // - Entry[] (legacy format: basic key-value pairs without type classification:
    //   -> for whether it's a aws secret partial reference or not)

    // - ClassifiedEntry[]
    //   -> both json direct values and aws secrets entries with type classification

    let entries: Entry[] | ClassifiedEntry[];
    let isLegacyFormat: boolean;

    if (jsonInput && !awsSecretReferencesInput) {
      // Legacy format-> json only (i.e. direct values)
      isLegacyFormat = true;
      entries = extractEntriesDefault(
        jsonInput,
        process.env,
        Boolean(shouldSort),
        Boolean(shouldFailOnEmpty)
      );
    } else if (awsSecretReferencesInput) {
      // aws_secret_references + (optional json direct values)
      // aws_region is required for this format
      if (!awsRegion) {
        throw new Error(
          'aws_region input is required when using aws_secret_references'
        );
      }

      // Validate AWS credentials (partial credentials not allowed)
      validateAWSCredentials(
        awsAccessKeyId,
        awsSecretAccessKey,
        awsSessionToken
      );

      isLegacyFormat = false;
      entries = extractEntries(
        awsSecretReferencesInput,
        jsonInput,
        process.env,
        Boolean(shouldSort),
        Boolean(shouldFailOnEmpty)
      );
    } else {
      isLegacyFormat = true;
      entries = extractEntriesDefault(
        '{}',
        process.env,
        Boolean(shouldSort),
        Boolean(shouldFailOnEmpty)
      );
    }

    if (entries.length < 1) throw new Error('No valid entries were found');

    // Generate deployment config based on format
    let output: string;
    let secretValues: AWSSecretStringData | undefined;

    if (isLegacyFormat) {
      // Legacy format: use default formatter - direct values
      output = ebextensionsEnvVarsDefaultFormatter(entries);
    } else {
      // use SecretManager formatter for AWS Secrets Manager ARNs
      // AWS SDK automatically falls back to scope credentials when credentials are not provided
      const credentialType =
        awsAccessKeyId && awsSecretAccessKey && awsSessionToken
          ? 'explicit'
          : 'scope';
      core.debug(
        `Using ${credentialType} AWS credentials for Secrets Manager ARN resolution...`
      );

      const classifiedEntries = entries as ClassifiedEntry[];
      const awsConfig: AWSConfig = {
        region: awsRegion,
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        sessionToken: awsSessionToken
      };

      // Filter only secret name reference entries for fetching respective Secrets Data from AWS
      const secretReferenceEntries = classifiedEntries.filter(
        entry => entry.type === 'aws_secret_reference'
      );

      // Fetch secrets data from AWS
      const result = await fetchAllSecretsDataFromAWS(
        secretReferenceEntries,
        awsConfig
      );

      secretValues = result.secretValues;
      // format using the pre-fetched data
      output = ebextensionsEnvVarsSecretManagerFormatter(
        classifiedEntries,
        result.arns
      );
    }

    core.debug(`Creating file: ${outputPath}`);
    core.setOutput('result', output);
    fs.writeFileSync(outputPath, output);

    // Generate test config if requested (has rendered_file_path)
    if (renderedFilePath && renderedFilePath.trim() !== '' && !isLegacyFormat) {
      if (secretValues) {
        const resolvedEntries = buildResolvedEntriesFromSecretValues(
          entries as ClassifiedEntry[],
          secretValues
        );

        // Convert resolved entries to the format expected by the formatter
        const testEntries = resolvedEntries.map(entry => ({
          key: entry.key,
          value: entry.resolvedValue
        }));

        const testConfigOutput =
          ebextensionsEnvVarsDefaultFormatter(testEntries);
        const testConfigPath = getOutputPath(
          renderedFilePath,
          'envvars-test.config'
        );

        core.debug(`Creating test file: ${testConfigPath}`);
        core.setOutput('test_config', testConfigOutput);
        fs.writeFileSync(testConfigPath, testConfigOutput);

        core.info(`Generated both files:
          - Deployment config: ${outputPath} (with AWS Secrets Manager references)
          - Test config: ${testConfigPath} (with actual resolved values for testing)`);
      } else {
        // This shouldn't happen, but fallback just in case
        core.debug('No secret values available for test config generation');
        const testConfigOutput = ebextensionsEnvVarsDefaultFormatter(
          entries as Entry[]
        );
        const testConfigPath = getOutputPath(
          renderedFilePath,
          'envvars-test.config'
        );

        core.debug(`Creating fallback test file: ${testConfigPath}`);
        core.setOutput('test_config', testConfigOutput);
        fs.writeFileSync(testConfigPath, testConfigOutput);

        core.info(`Generated both files:
          - Deployment config: ${outputPath} (with AWS Secrets Manager references)
          - Test config: ${testConfigPath} (with unresolved references - testing may fail)`);
      }
    } else {
      core.info(
        `Generated deployment config: ${outputPath} (${isLegacyFormat ? 'legacy format' : 'with AWS Secrets Manager references'})`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      core.debug(`[main] Error: ${error.message}`);
      core.setFailed(`[main] Error: ${error.message}`);
    }
  }
}
