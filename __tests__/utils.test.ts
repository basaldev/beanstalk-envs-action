import * as utils from '../src/utils';
import { ClassifiedEntry } from '../src/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetSecretValueCommand: jest.fn()
}));

// Mock @actions/core
jest.mock('@actions/core', () => ({
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}));

import { testUtils, testData } from './mocks';

let originalProcessEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalProcessEnv = { ...process.env };
  testUtils.resetAllMocks();
});

afterEach(() => {
  process.env = originalProcessEnv;
});

describe('utils: extractYamlKey', () => {
  it('should return MY_YAML_KEY', () => {
    const result = utils.extractYamlKey(
      'SOMETHING_SOMETHING_INPUT_EBX_MY_YAML_KEY'
    );
    expect(result).toBe('MY_YAML_KEY');
  });

  it('should return hello___world', () => {
    const result = utils.extractYamlKey('_INPUT_EBX_hello___world');
    expect(result).toBe('hello___world');
  });
});

describe('utils: findDuplicateEntries', () => {
  it('should return an array of 1 duplicate [same length arrays]', () => {
    const arr1 = [
      { key: 'test_a', value: 1 },
      { key: 'test_b', value: 2 },
      { key: 'test_c', value: 3 }
    ];
    const arr2 = [
      { key: 'test_a', value: 100 },
      { key: 'test_x', value: 101 },
      { key: 'test_y', value: 102 }
    ];
    const result = utils.findDuplicateEntries([...arr1, ...arr2]);
    expect(result.length).toBe(1);
  });

  it('should return an array of 1 duplicate [different length arrays]', () => {
    const arr1 = [
      { key: 'test_a', value: 1 },
      { key: 'test_b', value: 2 },
      { key: 'test_c', value: 3 },
      { key: 'test_d', value: 4 }
    ];
    const arr2 = [
      { key: 'test_a', value: 100 },
      { key: 'test_x', value: 101 }
    ];
    const result = utils.findDuplicateEntries([...arr1, ...arr2]);
    expect(result.length).toBe(1);
  });
});

describe('utils: extractEntriesDefault', () => {
  describe('success', () => {
    it('should return parsed json in { key: string; value: any }[] i.e. Entry[] type format (single item)', () => {
      const jsonInput = { my_var_key: 'json_test' };
      const result = utils.extractEntriesDefault(
        JSON.stringify(jsonInput),
        process.env
      );
      expect(result).toEqual([{ key: 'my_var_key', value: 'json_test' }]);
    });

    it('should return parsed json in { key: string; value: any }[] i.e. Entry[] type format (multiple items)', () => {
      const jsonInput = {
        my_var_key_1: 'mock_value_1',
        my_var_key_2: 'mock_value_2'
      };
      const result = utils.extractEntriesDefault(
        JSON.stringify(jsonInput),
        process.env
      );
      expect(result.length).toBe(2);
      expect(result).toEqual([
        { key: 'my_var_key_1', value: 'mock_value_1' },
        { key: 'my_var_key_2', value: 'mock_value_2' }
      ]);
    });

    it('should return parsed yaml inputs in { key: string; value: any }[] i.e. Entry[] type format', () => {
      testUtils.setupEnvVars({
        my_var_key_1: 'mock_value_1',
        my_var_key_2: 'mock_value_2'
      });
      const result = utils.extractEntriesDefault('{}', process.env);
      expect(result.length).toBe(2);
      expect(result).toEqual([
        { key: 'my_var_key_1', value: 'mock_value_1' },
        { key: 'my_var_key_2', value: 'mock_value_2' }
      ]);
    });

    it('should return a mixture of parsed yaml and json inputs in { key: string; value: any }[] i.e. Entry[] type format', () => {
      testUtils.setupEnvVars({ my_var_key_1: 'mock_value_1' });
      const jsonInput = { my_var_key_2: 'mock_value_2' };
      const result = utils.extractEntriesDefault(
        JSON.stringify(jsonInput),
        process.env
      );
      expect(result.length).toBe(2);
      expect(result).toEqual([
        { key: 'my_var_key_1', value: 'mock_value_1' },
        { key: 'my_var_key_2', value: 'mock_value_2' }
      ]);
    });

    it('should return a sorted list in { key: string; value: any }[] i.e. Entry[] type format', () => {
      testUtils.setupEnvVars({
        orange: 'mock_value_1',
        banana: 'mock_value_2'
      });
      const jsonInput = { apple: 'mock_value_3', pineapple: 'mock_value_4' };
      const shouldSort = true;
      const result = utils.extractEntriesDefault(
        JSON.stringify(jsonInput),
        process.env,
        shouldSort
      );
      expect(result.length).toBe(4);
      expect(result).toEqual([
        { key: 'apple', value: 'mock_value_3' },
        { key: 'banana', value: 'mock_value_2' },
        { key: 'orange', value: 'mock_value_1' },
        { key: 'pineapple', value: 'mock_value_4' }
      ]);
    });

    it('should return entries array even though empty string value is passed (fail_on_empty=`false`)', () => {
      const result = utils.extractEntriesDefault(
        JSON.stringify({ mock_a: '' }),
        process.env
      );
      expect(result).toEqual([{ key: 'mock_a', value: '' }]);
    });

    it('should return entries array even though null string value is passed (fail_on_empty=`false`)', () => {
      const result = utils.extractEntriesDefault(
        JSON.stringify({ mock_a: null }),
        process.env
      );
      expect(result).toEqual([{ key: 'mock_a', value: null }]);
    });
  });

  describe('error handling', () => {
    it('should return an empty array when invalid json is passed (invalid ,)', () => {
      const result = utils.extractEntriesDefault('{},', process.env);
      expect(result).toEqual([]);
    });

    it('should return an empty array when invalid json is passed (missing quotes)', () => {
      const result = utils.extractEntriesDefault(
        `{ missing_quotes: 'missing_closing_quote }`,
        process.env
      );
      expect(result).toEqual([]);
    });

    it('should return an empty array when empty string value is passed and fail_on_empty is `true`', () => {
      const shouldFailOnEmpty = true;
      const result = utils.extractEntriesDefault(
        JSON.stringify({ mock_a: '' }),
        process.env,
        false,
        shouldFailOnEmpty
      );
      expect(result).toEqual([]);
    });

    it('should return entries with null values when fail_on_empty is `false`', () => {
      const shouldFailOnEmpty = false;
      const result = utils.extractEntriesDefault(
        JSON.stringify({ mock_a: null }),
        process.env,
        false,
        shouldFailOnEmpty
      );
      expect(result).toEqual([{ key: 'mock_a', value: null }]);
    });
  });
});

describe('utils: extractEntries (aws_secret_references format)', () => {
  describe('success', () => {
    it('should return parsed secrets and direct values in ClassifiedEntry format (single item)', () => {
      const secretsInput = { my_var_key: 'projectname-dev:my_var_key' };
      const directValuesInput = {};
      const result = utils.extractEntries(
        JSON.stringify(secretsInput),
        JSON.stringify(directValuesInput),
        process.env
      );
      expect(result).toEqual([{ key: 'my_var_key', value: 'projectname-dev:my_var_key', type: 'aws_secret_reference' }]);
    });

    it('should return parsed secrets and direct values in ClassifiedEntry format (multiple items)', () => {
      const secretsInput = {
        my_var_key_1: 'projectname-dev:my_var_key_1',
        my_var_key_2: 'projectname-dev:my_var_key_2'
      };
      const directValuesInput = {};
      const result = utils.extractEntries(
        JSON.stringify(secretsInput),
        JSON.stringify(directValuesInput),
        process.env
      );
      expect(result.length).toBe(2);
      expect(result).toEqual([
        { key: 'my_var_key_1', value: 'projectname-dev:my_var_key_1', type: 'aws_secret_reference' },
        { key: 'my_var_key_2', value: 'projectname-dev:my_var_key_2', type: 'aws_secret_reference' }
      ]);
    });

    it('should return parsed yaml inputs in ClassifiedEntry format', () => {
      testUtils.setupEnvVars({
        my_var_key_1: 'mock_value_1',
        my_var_key_2: 'mock_value_2'
      });
      const result = utils.extractEntries('{}', '{}', process.env);
      expect(result.length).toBe(2);
      expect(result).toEqual([
        { key: 'my_var_key_1', value: 'mock_value_1', type: 'direct_value' },
        { key: 'my_var_key_2', value: 'mock_value_2', type: 'direct_value' }
      ]);
    });

    it('should return a mixture of parsed yaml, secrets, and direct values in ClassifiedEntry format', () => {
      testUtils.setupEnvVars({ my_var_key_1: 'mock_value_1' });
      const secretsInput = { my_var_key_2: 'projectname-dev:my_var_key_2' };
      const directValuesInput = { my_var_key_3: 'mock_value_3' };
      const result = utils.extractEntries(
        JSON.stringify(secretsInput),
        JSON.stringify(directValuesInput),
        process.env
      );
      expect(result.length).toBe(3);
      expect(result).toHaveLength(3);
      expect(result.find(r => r.key === 'my_var_key_1')).toEqual({ key: 'my_var_key_1', value: 'mock_value_1', type: 'direct_value' });
      expect(result.find(r => r.key === 'my_var_key_2')).toEqual({ key: 'my_var_key_2', value: 'projectname-dev:my_var_key_2', type: 'aws_secret_reference' });
      expect(result.find(r => r.key === 'my_var_key_3')).toEqual({ key: 'my_var_key_3', value: 'mock_value_3', type: 'direct_value' });
    });

    it('should return a sorted list in ClassifiedEntry format', () => {
      testUtils.setupEnvVars({
        orange: 'mock_value_1',
        banana: 'mock_value_2'
      });
      const secretsInput = { apple: 'projectname-dev:apple' };
      const directValuesInput = { pineapple: 'mock_value_4' };
      const shouldSort = true;
      const result = utils.extractEntries(
        JSON.stringify(secretsInput),
        JSON.stringify(directValuesInput),
        process.env,
        shouldSort
      );
      expect(result.length).toBe(4);
      expect(result).toEqual([
        { key: 'apple', value: 'projectname-dev:apple', type: 'aws_secret_reference' },
        { key: 'banana', value: 'mock_value_2', type: 'direct_value' },
        { key: 'orange', value: 'mock_value_1', type: 'direct_value' },
        { key: 'pineapple', value: 'mock_value_4', type: 'direct_value' }
      ]);
    });

    it('should return entries array even though empty string value is passed (fail_on_empty=`false`)', () => {
      const result = utils.extractEntries(
        JSON.stringify({ mock_a: '' }),
        JSON.stringify({}),
        process.env
      );
      expect(result).toEqual([{ key: 'mock_a', value: '', type: 'aws_secret_reference' }]);
    });

    it('should return entries array even though null string value is passed (fail_on_empty=`false`)', () => {
      const result = utils.extractEntries(
        JSON.stringify({ mock_a: null }),
        JSON.stringify({}),
        process.env
      );
      expect(result).toEqual([{ key: 'mock_a', value: null, type: 'aws_secret_reference' }]);
    });
  });

  describe('error handling', () => {
    it('should return an empty array when invalid json is passed (invalid ,)', () => {
      const result = utils.extractEntries('{},', '{}', process.env);
      expect(result).toEqual([]);
    });

    it('should return an empty array when invalid json is passed (missing quotes)', () => {
      const result = utils.extractEntries(
        `{ missing_quotes: 'missing_closing_quote }`,
        '{}',
        process.env
      );
      expect(result).toEqual([]);
    });

    it('should return an empty array when empty string value is passed and fail_on_empty is `true`', () => {
      const shouldFailOnEmpty = true;
      const result = utils.extractEntries(
        JSON.stringify({ mock_a: '' }),
        JSON.stringify({}),
        process.env,
        false,
        shouldFailOnEmpty
      );
      expect(result).toEqual([]);
    });

    it('should return entries with null values when fail_on_empty is `false`', () => {
      const shouldFailOnEmpty = false;
      const result = utils.extractEntries(
        JSON.stringify({ mock_a: null }),
        JSON.stringify({}),
        process.env,
        false,
        shouldFailOnEmpty
      );
      expect(result).toEqual([{ key: 'mock_a', value: null, type: 'aws_secret_reference' }]);
    });
  });
});

describe('utils: resolvePartialReferencesToValues', () => {
  beforeEach(() => {
    testUtils.resetAllMocks();
  });

  it('should group entries by secret name and make minimal API calls', async () => {
    const entries: ClassifiedEntry[] = [
      { key: 'APP_ENV', value: 'projectname-dev-shared-vars:APP_ENVIRONMENT', type: 'aws_secret_reference' as const },
      { key: 'AUTH_PREFIX', value: 'projectname-dev-shared-vars:AUTH_SERVICE_ENDPOINT_PREFIX', type: 'aws_secret_reference' as const },
      { key: 'DB_CONN', value: 'projectname-dev-bfb:DATABASE_CONNECTION_STRING', type: 'aws_secret_reference' as const },
      { key: 'AWS_REGION', value: 'ap-northeast-1', type: 'direct_value' as const },
      { key: 'NODE_ENV', value: 'projectname-dev-shared-vars:NODE_ENV', type: 'aws_secret_reference' as const }
    ];

    // Mock responses for different secrets
    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest.fn();
    
    // Set up sequential responses for different secrets
    mockSend
      .mockResolvedValueOnce({
        SecretString: JSON.stringify({
          APP_ENVIRONMENT: 'dev',
          AUTH_SERVICE_ENDPOINT_PREFIX: '/auth-api',
          NODE_ENV: 'production'
        })
      })
      .mockResolvedValueOnce({
        SecretString: JSON.stringify({
          DATABASE_CONNECTION_STRING: 'mongodb://localhost:27017/test'
        })
      });
    
    // Update the mock implementation
    SecretsManagerClient.mockImplementation(() => ({
      send: mockSend
    }));

    const result = await utils.resolvePartialReferencesToValues(entries, testData.awsConfig);

    // Should make only 2 API calls (one per secret name)
    expect(mockSend).toHaveBeenCalledTimes(2);

    // Verify all entries are resolved correctly
    expect(result).toHaveLength(5);
    
    // Secret references should be resolved
    expect(result.find(r => r.key === 'APP_ENV')).toEqual({
      key: 'APP_ENV',
      resolvedValue: 'dev',
      originalValue: 'projectname-dev-shared-vars:APP_ENVIRONMENT',
      resolutionStatus: 'success'
    });

    expect(result.find(r => r.key === 'AUTH_PREFIX')).toEqual({
      key: 'AUTH_PREFIX',
      resolvedValue: '/auth-api',
      originalValue: 'projectname-dev-shared-vars:AUTH_SERVICE_ENDPOINT_PREFIX',
      resolutionStatus: 'success'
    });

    expect(result.find(r => r.key === 'DB_CONN')).toEqual({
      key: 'DB_CONN',
      resolvedValue: 'mongodb://localhost:27017/test',
      originalValue: 'projectname-dev-bfb:DATABASE_CONNECTION_STRING',
      resolutionStatus: 'success'
    });

    expect(result.find(r => r.key === 'NODE_ENV')).toEqual({
      key: 'NODE_ENV',
      resolvedValue: 'production',
      originalValue: 'projectname-dev-shared-vars:NODE_ENV',
      resolutionStatus: 'success'
    });

    // Direct values should remain unchanged
    expect(result.find(r => r.key === 'AWS_REGION')).toEqual({
      key: 'AWS_REGION',
      resolvedValue: 'ap-northeast-1',
      originalValue: 'ap-northeast-1',
      resolutionStatus: 'not_required'
    });
  });

  it('should handle AWS API failures gracefully', async () => {
    const entries: ClassifiedEntry[] = [
      { key: 'APP_ENV', value: 'projectname-dev-shared-vars:APP_ENVIRONMENT', type: 'aws_secret_reference' as const },
      { key: 'AUTH_PREFIX', value: 'projectname-dev-shared-vars:AUTH_SERVICE_ENDPOINT_PREFIX', type: 'aws_secret_reference' as const }
    ];

    // Mock API failure
    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest.fn();
    mockSend.mockRejectedValue(new Error('AWS API Error'));
    
    // Update the mock implementation
    SecretsManagerClient.mockImplementation(() => ({
      send: mockSend
    }));

    const result = await utils.resolvePartialReferencesToValues(entries, testData.awsConfig);

    // Should make 1 API call (for the single secret name)
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Should fall back to original values
    expect(result).toHaveLength(2);
    expect(result.find(r => r.key === 'APP_ENV')).toEqual({
      key: 'APP_ENV',
      resolvedValue: 'projectname-dev-shared-vars:APP_ENVIRONMENT',
      originalValue: 'projectname-dev-shared-vars:APP_ENVIRONMENT',
      resolutionStatus: 'failed'
    });
  });
});
