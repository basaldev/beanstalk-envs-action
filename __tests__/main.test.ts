/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as main from '../src/main';
import * as constants from '../src/constants';

// Mock file system
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue('')
  }
}));

// Mock AWS SDK to prevent credential loading
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({ test: 'value' })
    })
  })),
  GetSecretValueCommand: jest.fn()
}));

// Mock GitHub Actions core
jest.mock('@actions/core', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn()
}));

// Import centralized test utilities after mocks
import { testUtils, mockInputPatterns } from './mocks';

describe('action', () => {
  beforeEach(() => {
    testUtils.resetAllMocks();
    testUtils.cleanupEnvVars();
  });

  it('should use default directory and filename', async () => {
    const defaultDirectory = '.ebextensions';
    const defaultFilename = 'envvars.config';
    
    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return mockInputPatterns.onlyDirectValues.json;
        default:
          return '';
      }
    });

    await main.run();

    expect(core.debug).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`${defaultDirectory}/${defaultFilename}`)
    );
    expect(core.error).not.toHaveBeenCalled();
  });

  it('should use user inputted values for directory and filename', async () => {
    const userSpecifiedDirectory = 'some-directory';
    const userSpecifiedFilename = 'secrets';
    
    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return mockInputPatterns.onlyDirectValues.json;
        case 'directory':
          return userSpecifiedDirectory;
        case 'filename':
          return userSpecifiedFilename;
        default:
          return '';
      }
    });

    await main.run();

    expect(core.debug).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        `${userSpecifiedDirectory}/${userSpecifiedFilename}`
      )
    );
    expect(core.error).not.toHaveBeenCalled();
  });

  it('should output user inputted json values to file', async () => {
    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return JSON.stringify({ HELLO: 'WORLD' });
        default:
          return '';
      }
    });

    await main.run();

    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining('HELLO')
    );
    expect(core.error).not.toHaveBeenCalled();
  });

  it('should output user inputted yaml entries to file', async () => {
    const mockValue = 'yaml_test';
    const mockKey = 'MY_YAML_KEY';
    
    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return '';
        default:
          return '';
      }
    });

    testUtils.setupEnvVars({ [mockKey]: mockValue });

    await main.run();

    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining(mockValue)
    );
    expect(core.error).not.toHaveBeenCalled();
  });

  it('should output user both json and yaml entries to file', async () => {
    const mockYamlKey = 'MY_YAML_KEY';
    const mockYamlValue = 'yaml_test';
    const mockJson = { MY_JSON_KEY: 'json_test' };

    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return JSON.stringify(mockJson);
        default:
          return '';
      }
    });

    testUtils.setupEnvVars({ [mockYamlKey]: mockYamlValue });

    await main.run();

    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining(`value: ${mockYamlValue}`)
    );

    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining(`value: ${mockJson.MY_JSON_KEY}`)
    );

    expect(core.error).not.toHaveBeenCalled();
  });

  it('should throw an error due to a single duplicate key being defined', async () => {
    const mockYamlKey = 'MY_DUPLICATE_KEY';
    const mockYamlValue = 'yaml_test';
    const mockJson = { MY_DUPLICATE_KEY: 'json_test' };

    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return JSON.stringify(mockJson);
        default:
          return '';
      }
    });

    testUtils.setupEnvVars({ [mockYamlKey]: mockYamlValue });

    await main.run();
    
    expect(core.error).toHaveBeenCalledWith(
      '[extractEntriesDefault] Error: Duplicate keys detected (MY_DUPLICATE_KEY)'
    );
    expect(core.setFailed).toHaveBeenCalledWith(
      '[main] Error: No valid entries were found'
    );
  });

  it('should throw an error due to multiple duplicate keys being defined', async () => {
    const mockYamlKey = 'MY_DUPLICATE_KEY';
    const anotherMockYamlKey = 'ANOTHER_DUPLICATE_KEY';
    const mockYamlValue = 'yaml_test';
    const mockJson = {
      MY_DUPLICATE_KEY: 'json_test',
      ANOTHER_DUPLICATE_KEY: 'mock_value'
    };

    const core = require('@actions/core');
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'json':
          return JSON.stringify(mockJson);
        default:
          return '';
      }
    });

    testUtils.setupEnvVars({ 
      [mockYamlKey]: mockYamlValue,
      [anotherMockYamlKey]: mockYamlValue
    });

    await main.run();
    
    expect(core.error).toHaveBeenCalledWith(
      '[extractEntriesDefault] Error: Duplicate keys detected (MY_DUPLICATE_KEY,ANOTHER_DUPLICATE_KEY)'
    );
    expect(core.setFailed).toHaveBeenCalledWith(
      '[main] Error: No valid entries were found'
    );
  });

  describe('aws_secret_references workflow', () => {
    it('should use aws_secret_references format and generate both deployment and test configs', async () => {
      const core = require('@actions/core');
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'aws_secret_references':
            return mockInputPatterns.directValuesAndSecretReferences.aws_secret_references;
          case 'json':
            return mockInputPatterns.directValuesAndSecretReferences.json;
          case 'aws_region':
            return mockInputPatterns.directValuesAndSecretReferences.aws_region;
          case 'rendered_file_path':
            return mockInputPatterns.directValuesAndSecretReferences.rendered_file_path;
          default:
            return '';
        }
      });

      await main.run();

      // Should generate deployment config with SecretManager formatter
      expect(core.setOutput).toHaveBeenCalledWith(
        'result',
        expect.stringContaining('aws:elasticbeanstalk:application:environmentsecrets')
      );
      
      expect(core.setOutput).toHaveBeenCalledWith(
        'test_config',
        expect.any(String)
      );

      expect(core.error).not.toHaveBeenCalled();
    });

    it('should throw error when aws_secret_references provided but aws_region missing', async () => {
      const core = require('@actions/core');
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'aws_secret_references':
            return mockInputPatterns.directValuesAndSecretReferences.aws_secret_references;
          case 'json':
            return mockInputPatterns.directValuesAndSecretReferences.json;
          case 'aws_region':
            return ''; // Missing aws_region
          default:
            return '';
        }
      });

      await main.run();

      expect(core.setFailed).toHaveBeenCalledWith(
        '[main] Error: aws_region input is required when using aws_secret_references'
      );
    });

    it('should throw error due to duplicate keys in aws_secret_references + json', async () => {
      const core = require('@actions/core');
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'aws_secret_references':
            return JSON.stringify({
              DUPLICATE_KEY: 'projectname-dev:APP_ENV'
            });
          case 'json':
            return JSON.stringify({
              DUPLICATE_KEY: 'production'
            });
          case 'aws_region':
            return mockInputPatterns.directValuesAndSecretReferences.aws_region;
          case 'rendered_file_path':
            return mockInputPatterns.directValuesAndSecretReferences.rendered_file_path;
          default:
            return '';
        }
      });

      await main.run();

      expect(core.error).toHaveBeenCalledWith(
        '[extractEntries] Error: Duplicate keys detected (DUPLICATE_KEY)'
      );
      expect(core.setFailed).toHaveBeenCalledWith(
        '[main] Error: No valid entries were found'
      );
    });

    it('should handle aws_secret_references only (when there is no json i.e. direct values)', async () => {
      const core = require('@actions/core');
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'aws_secret_references':
            return mockInputPatterns.directValuesAndSecretReferences.aws_secret_references;
          case 'json':
            return ''; // No direct values
          case 'aws_region':
            return mockInputPatterns.directValuesAndSecretReferences.aws_region;
          case 'rendered_file_path':
            return mockInputPatterns.directValuesAndSecretReferences.rendered_file_path;
          default:
            return '';
        }
      });

      await main.run();

      expect(core.setOutput).toHaveBeenCalledWith(
        'result',
        expect.stringContaining('aws:elasticbeanstalk:application:environmentsecrets')
      );

      expect(core.error).not.toHaveBeenCalled();
    });

    it('should handle json only (no aws_secret_references)', async () => {
      const core = require('@actions/core');
      core.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'aws_secret_references':
            return ''; // No secret references
          case 'json':
            return mockInputPatterns.directValuesAndSecretReferences.json;
          case 'aws_region':
            return mockInputPatterns.directValuesAndSecretReferences.aws_region;
          default:
            return '';
        }
      });

      await main.run();

      expect(core.setOutput).toHaveBeenCalledWith(
        'result',
        expect.stringContaining('option_name: NODE_ENV')
      );

      expect(core.error).not.toHaveBeenCalled();
    });
  });
});
