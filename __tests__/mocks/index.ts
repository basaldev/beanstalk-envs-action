/**
 * mocks and test utilities
 *
 */

export const mockFs = {
  writeFileSync: jest.fn(),
  promises: {
    access: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue('')
  }
};

export const mockSecretsManagerClient = {
  send: jest.fn()
};

export const mockGetSecretValueCommand = jest.fn();

// Mock AWS Secrets Manager responses
export const mockSecretResponses = {
  'projectname-dev-shared-shopify-vars': {
    ARN: 'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN',
    SecretString: JSON.stringify({
      SHOPIFY_PRODUCT_VARIANT_ABC: '19191919191919',
      SHOPIFY_PRODUCT_VARIANT_DEF: '19191919191918',
      SHOPIFY_PRODUCT_VARIANT_GHI: '19191919191917'
    })
  },
  'projectname-dev-shared-vars': {
    ARN: 'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-vars-yPq1bM',
    SecretString: JSON.stringify({
      APP_ENV: 'dev',
      AUTH_SERVICE_ENDPOINT_PREFIX: '/auth-api'
    })
  },
  'projectname-dev-bfb': {
    ARN: 'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-bfb-zRr2cN',
    SecretString: JSON.stringify({
      DATABASE_CONNECTION_STRING: 'mongodb://localhost:27017/test'
    })
  }
};

export const testData = {
  entries: {
    single: { key: 'TEST_KEY', value: 'test_value' },
    multiple: [
      { key: 'KEY_1', value: 'value_1' },
      { key: 'KEY_2', value: 'value_2' }
    ],
    withNull: { key: 'NULL_KEY', value: null },
    withEmpty: { key: 'EMPTY_KEY', value: '' }
  },
  secrets: {
    single: 'projectname-dev-shared-vars',
    multiple: ['projectname-dev-shared-vars', 'projectname-dev-bfb']
  },
  awsConfig: {
    region: 'ap-northeast-1'
  },
  awsConfigWithCredentials: {
    region: 'ap-northeast-1',
    accessKeyId: 'IKEAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'AQoEXAMPLEH4aoAH0gNCAPyJxzrBlCFFxWNE1OPTgk5TthT...'
  },
  classifiedEntries: [
    {
      key: 'SHOPIFY_PRODUCT_VARIANT_ABC',
      value: 'projectname-dev-shared-shopify-vars',
      type: 'aws_secret_reference' as const
    },
    {
      key: 'AWS_REGION',
      value: 'ap-northeast-1',
      type: 'direct_value' as const
    }
  ],
  secretValues: {
    'projectname-dev-shared-shopify-vars': {
      SHOPIFY_PRODUCT_VARIANT_ABC: '19191919191919',
      SHOPIFY_PRODUCT_VARIANT_DEF: '19191919191918'
    }
  },
  arns: {
    'projectname-dev-shared-shopify-vars':
      'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN'
  }
};

export const formatterTestData = {
  secretManagerReferenceEntries: [
    {
      key: 'SHOPIFY_PRODUCT_VARIANT_ABC',
      value: 'projectname-dev-shared-shopify-vars',
      type: 'aws_secret_reference' as const
    },
    {
      key: 'AWS_REGION',
      value: 'ap-northeast-1',
      type: 'direct_value' as const
    },
    {
      key: 'SHOPIFY_PRODUCT_VARIANT_DEF',
      value: 'projectname-dev-shared-shopify-vars',
      type: 'aws_secret_reference' as const
    },
    {
      key: 'NODE_ENV',
      value: 'development',
      type: 'direct_value' as const
    }
  ],
  defaultDirectValueEntries: [
    { key: 'APP_ENVIRONMENT', value: 'development' },
    { key: 'NODE_ENV', value: 'development' },
    { key: 'DATABASE_URL', value: 'postgresql://localhost:5432/mydb' }
  ]
};

export const mockInputPatterns = {
  onlyDirectValues: {
    json: JSON.stringify({ mock_key: 'mock_value' })
  },
  directValuesAndSecretReferences: {
    aws_secret_references: JSON.stringify({
      SHOPIFY_PRODUCT_VARIANT_ABC: 'projectname-dev-shared-shopify-vars',
      SHOPIFY_PRODUCT_VARIANT_DEF: 'projectname-dev-shared-shopify-vars'
    }),
    json: JSON.stringify({
      AWS_REGION: 'ap-northeast-1',
      NODE_ENV: 'production'
    }),
    aws_region: 'ap-northeast-1',
    rendered_file_path: './test-output'
  }
};

// Common test utils
export const testUtils = {
  // Clean up environment variables
  cleanupEnvVars: () => {
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('INPUT_EBX_')) {
        delete process.env[key];
      }
    });
  },

  // Set up environment variables for testing
  setupEnvVars: (vars: Record<string, string>) => {
    Object.entries(vars).forEach(([key, value]) => {
      process.env[`INPUT_EBX_${key}`] = value;
    });
  },

  // Reset all mocks
  resetAllMocks: () => {
    mockFs.writeFileSync.mockReset();
    mockFs.promises.access.mockReset();
    mockFs.promises.writeFile.mockReset();
    mockSecretsManagerClient.send.mockReset();
    mockGetSecretValueCommand.mockReset();
  }
};
