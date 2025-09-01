import * as core from '@actions/core';
import * as fs from 'fs';

import { extractEntriesDefault, extractEntries, getOutputPath, resolvePartialReferencesToValues } from './utils';
import { ebextensionsEnvVarsSecretManagerFormatter, ebextensionsEnvVarsDefaultFormatter } from './formatters';
import { Entry, ClassifiedEntry, AWSConfig } from './types';

export async function run() {
  try {
    const directory = core.getInput('directory') || '.ebextensions';
    const fileName = core.getInput('filename') || 'envvars.config';
    const jsonInput = core.getInput('json') || '{}';
    const awsSecretReferencesInput = core.getInput('aws_secret_references') || '';
    const outputPath = getOutputPath(directory, fileName);
    const shouldSort = core.getInput('sort_keys') || 'false';
    const shouldFailOnEmpty = core.getInput('fail_on_empty');
    const renderedFilePath = core.getInput('rendered_file_path') || '';
    const awsRegion = core.getInput('aws_region');
    
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
        throw new Error('aws_region input is required when using aws_secret_references');
      }     
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
    if (isLegacyFormat) {
      // Legacy format: use default formatter - direct values
      output = ebextensionsEnvVarsDefaultFormatter(entries);
    } else {
      // use SecretManager formatter for AWS Secrets Manager ARNs
      const classifiedEntries = entries as ClassifiedEntry[];
      output = ebextensionsEnvVarsSecretManagerFormatter(classifiedEntries, awsRegion);
    }

    core.debug(`Creating file: ${outputPath}`);
    core.setOutput('result', output);
    fs.writeFileSync(outputPath, output);

    // Generate test config if requested (has rendered_file_path)
    if (renderedFilePath && renderedFilePath.trim() !== '' && !isLegacyFormat) {
      try {
        const awsConfig: AWSConfig = {
          region: awsRegion
        };
        
        // Resolve aws secret references to actual values for testing
        const resolvedEntries = await resolvePartialReferencesToValues(entries as ClassifiedEntry[], awsConfig);
        
        // Convert resolved entries to the format expected by the formatter
        const testEntries = resolvedEntries.map(entry => ({
          key: entry.key,
          value: entry.resolvedValue
        }));
        
        const testConfigOutput = ebextensionsEnvVarsDefaultFormatter(testEntries);
        const testConfigPath = getOutputPath(renderedFilePath, 'envvars-test.config');
        
        core.debug(`Creating test file: ${testConfigPath}`);
        core.setOutput('test_config', testConfigOutput);
        fs.writeFileSync(testConfigPath, testConfigOutput);
        
        core.info(`Generated both files:
          - Deployment config: ${outputPath} (with AWS Secrets Manager references)
          - Test config: ${testConfigPath} (with actual resolved values for testing)`)
      } catch (error) {
        core.debug(`Failed to resolve secrets for test config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        core.debug('Generating test config with unresolved references (testing may fail)');
        
        // Fallback: generate test config with unresolved references
        const testConfigOutput = ebextensionsEnvVarsDefaultFormatter(entries as Entry[]);
        const testConfigPath = getOutputPath(renderedFilePath, 'envvars-test.config');
        
        core.debug(`Creating fallback test file: ${testConfigPath}`);
        core.setOutput('test_config', testConfigOutput);
        fs.writeFileSync(testConfigPath, testConfigOutput);
        
        core.info(`Generated both files:
          - Deployment config: ${outputPath} (with AWS Secrets Manager references)
          - Test config: ${testConfigPath} (with unresolved references - testing may fail)`)
      }
    } else {
      core.info(`Generated deployment config: ${outputPath} (${isLegacyFormat ? 'legacy format' : 'with AWS Secrets Manager references'})`)
    }
  } catch (error) {
    if (error instanceof Error) {
      core.debug(`[main] Error: ${error.message}`);
      core.setFailed(`[main] Error: ${error.message}`);
    }
  }
}
