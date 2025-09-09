/* eslint-disable import/first */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
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

import { testUtils, testData, mockSecretResponses } from './mocks';

let originalProcessEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalProcessEnv = { ...process.env };
  testUtils.resetAllMocks();
});

afterEach(() => {
  process.env = originalProcessEnv;
});

describe('utils: validateAWSCredentials', () => {
  it('should pass when all three credentials are provided', () => {
    expect(() => {
      utils.validateAWSCredentials(
        'IKEAIOSFODNN7EXAMPLE',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'AQoEXAMPLEH4aoAH0gNCAPyJxzrBlCFFxWNE1OPTgk5TthT...'
      );
    }).not.toThrow();
  });

  it('should pass when no credentials are provided', () => {
    expect(() => {
      utils.validateAWSCredentials('', '', '');
    }).not.toThrow();
  });

  it('should throw error when only access key is provided', () => {
    expect(() => {
      utils.validateAWSCredentials('IKEAIOSFODNN7EXAMPLE', '', '');
    }).toThrow(
      'Partial AWS credentials provided: aws_access_key_id. All three credentials must be provided together, or leave all three empty to use scope credentials.'
    );
  });

  it('should throw error when only access key and secret key are provided', () => {
    expect(() => {
      utils.validateAWSCredentials(
        'IKEAIOSFODNN7EXAMPLE',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        ''
      );
    }).toThrow(
      'Partial AWS credentials provided: aws_access_key_id, aws_secret_access_key. All three credentials must be provided together, or leave all three empty to use scope credentials.'
    );
  });

  it('should throw error when only secret key is provided', () => {
    expect(() => {
      utils.validateAWSCredentials(
        '',
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        ''
      );
    }).toThrow(
      'Partial AWS credentials provided: aws_secret_access_key. All three credentials must be provided together, or leave all three empty to use scope credentials.'
    );
  });

  it('should throw error when only session token is provided', () => {
    expect(() => {
      utils.validateAWSCredentials(
        '',
        '',
        'AQoEXAMPLEH4aoAH0gNCAPyJxzrBlCFFxWNE1OPTgk5TthT...'
      );
    }).toThrow(
      'Partial AWS credentials provided: aws_session_token. All three credentials must be provided together, or leave all three empty to use scope credentials.'
    );
  });
});

describe('utils: fetchAllSecretsDataFromAWS', () => {
  beforeEach(() => {
    testUtils.resetAllMocks();
  });

  it('should fetch ARNs and secret values for unique secret names', async () => {
    const entries: ClassifiedEntry[] = [
      {
        key: 'SHOPIFY_PRODUCT_VARIANT_ABC',
        value: 'projectname-dev-shared-shopify-vars',
        type: 'aws_secret_reference' as const
      },
      {
        key: 'SHOPIFY_PRODUCT_VARIANT_DEF',
        value: 'projectname-dev-shared-shopify-vars', // Same secret name
        type: 'aws_secret_reference' as const
      }
    ];

    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest
      .fn()
      .mockResolvedValue(
        mockSecretResponses['projectname-dev-shared-shopify-vars']
      );

    SecretsManagerClient.mockImplementation(() => ({
      send: mockSend
    }));

    const result = await utils.fetchAllSecretsDataFromAWS(
      entries,
      testData.awsConfig
    );

    // Should make only 1 API call (for the single unique secret name)
    expect(mockSend).toHaveBeenCalledTimes(1);

    expect(result.arns).toEqual({
      'projectname-dev-shared-shopify-vars':
        'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN'
    });

    expect(result.secretValues).toEqual({
      'projectname-dev-shared-shopify-vars': {
        SHOPIFY_PRODUCT_VARIANT_ABC: '19191919191919',
        SHOPIFY_PRODUCT_VARIANT_DEF: '19191919191918',
        SHOPIFY_PRODUCT_VARIANT_GHI: '19191919191917'
      }
    });
  });

  it('should handle multiple unique secret names', async () => {
    const entries: ClassifiedEntry[] = [
      {
        key: 'APP_ENV',
        value: 'projectname-dev-shared-vars',
        type: 'aws_secret_reference' as const
      },
      {
        key: 'DB_CONN',
        value: 'projectname-dev-bfb',
        type: 'aws_secret_reference' as const
      }
    ];

    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest
      .fn()
      .mockResolvedValueOnce(mockSecretResponses['projectname-dev-shared-vars'])
      .mockResolvedValueOnce(mockSecretResponses['projectname-dev-bfb']);

    SecretsManagerClient.mockImplementation(() => ({
      send: mockSend
    }));

    const result = await utils.fetchAllSecretsDataFromAWS(
      entries,
      testData.awsConfig
    );

    // Should make 2 API calls (one per unique secret name)
    expect(mockSend).toHaveBeenCalledTimes(2);

    expect(result.arns).toEqual({
      'projectname-dev-shared-vars':
        'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-vars-yPq1bM',
      'projectname-dev-bfb':
        'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-bfb-zRr2cN'
    });

    expect(result.secretValues).toEqual({
      'projectname-dev-shared-vars': {
        APP_ENV: 'dev',
        AUTH_SERVICE_ENDPOINT_PREFIX: '/auth-api'
      },
      'projectname-dev-bfb': {
        DATABASE_CONNECTION_STRING: 'mongodb://localhost:27017/test'
      }
    });
  });

  it('should throw error when secret fetch fails', async () => {
    const entries: ClassifiedEntry[] = [
      {
        key: 'APP_ENV',
        value: 'projectname-dev-shared-vars',
        type: 'aws_secret_reference' as const
      }
    ];

    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockSend = jest.fn().mockRejectedValue(new Error('AWS API Error'));

    SecretsManagerClient.mockImplementation(() => ({
      send: mockSend
    }));

    await expect(
      utils.fetchAllSecretsDataFromAWS(entries, testData.awsConfig)
    ).rejects.toThrow(
      'Failed to fetch secret projectname-dev-shared-vars: AWS API Error'
    );
  });
});

describe('utils: buildResolvedEntriesFromSecretValues', () => {
  it('should resolve secret references and keep direct values unchanged', () => {
    const entries = testData.classifiedEntries;
    const secretValues = testData.secretValues;

    const result = utils.buildResolvedEntriesFromSecretValues(
      entries,
      secretValues
    );

    expect(result).toEqual([
      {
        key: 'SHOPIFY_PRODUCT_VARIANT_ABC',
        resolvedValue: '19191919191919',
        originalValue: 'projectname-dev-shared-shopify-vars',
        resolutionStatus: 'success'
      },
      {
        key: 'AWS_REGION',
        resolvedValue: 'ap-northeast-1',
        originalValue: 'ap-northeast-1',
        resolutionStatus: 'not_required'
      }
    ]);
  });

  it('should handle missing secret keys with failed status', () => {
    const entries: ClassifiedEntry[] = [
      {
        key: 'MISSING_KEY',
        value: 'projectname-dev-shared-shopify-vars',
        type: 'aws_secret_reference' as const
      }
    ];

    const secretValues = {
      'projectname-dev-shared-shopify-vars': {
        EXISTING_KEY: 'some-value'
      }
    };

    const result = utils.buildResolvedEntriesFromSecretValues(
      entries,
      secretValues
    );

    expect(result).toEqual([
      {
        key: 'MISSING_KEY',
        resolvedValue: 'projectname-dev-shared-shopify-vars', // Fallback to secret name
        originalValue: 'projectname-dev-shared-shopify-vars',
        resolutionStatus: 'failed'
      }
    ]);
  });
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
      expect(result).toEqual([
        {
          key: 'my_var_key',
          value: 'projectname-dev:my_var_key',
          type: 'aws_secret_reference'
        }
      ]);
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
        {
          key: 'my_var_key_1',
          value: 'projectname-dev:my_var_key_1',
          type: 'aws_secret_reference'
        },
        {
          key: 'my_var_key_2',
          value: 'projectname-dev:my_var_key_2',
          type: 'aws_secret_reference'
        }
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
      expect(result.find(r => r.key === 'my_var_key_1')).toEqual({
        key: 'my_var_key_1',
        value: 'mock_value_1',
        type: 'direct_value'
      });
      expect(result.find(r => r.key === 'my_var_key_2')).toEqual({
        key: 'my_var_key_2',
        value: 'projectname-dev:my_var_key_2',
        type: 'aws_secret_reference'
      });
      expect(result.find(r => r.key === 'my_var_key_3')).toEqual({
        key: 'my_var_key_3',
        value: 'mock_value_3',
        type: 'direct_value'
      });
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
        {
          key: 'apple',
          value: 'projectname-dev:apple',
          type: 'aws_secret_reference'
        },
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
      expect(result).toEqual([
        { key: 'mock_a', value: '', type: 'aws_secret_reference' }
      ]);
    });

    it('should return entries array even though null string value is passed (fail_on_empty=`false`)', () => {
      const result = utils.extractEntries(
        JSON.stringify({ mock_a: null }),
        JSON.stringify({}),
        process.env
      );
      expect(result).toEqual([
        { key: 'mock_a', value: null, type: 'aws_secret_reference' }
      ]);
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
      expect(result).toEqual([
        { key: 'mock_a', value: null, type: 'aws_secret_reference' }
      ]);
    });
  });
});
