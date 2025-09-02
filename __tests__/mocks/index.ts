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

export const mockSTSClient = {
  send: jest.fn()
};

export const mockGetCallerIdentityCommand = jest.fn();

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
    single: 'projectname-dev:APP_ENV',
    multiple: ['projectname-dev:APP_ENV', 'projectname-dev:DATABASE_URL']
  },
  awsConfig: {
    region: 'ap-northeast-1'
  },
  awsConfigWithCredentials: {
    region: 'ap-northeast-1',
    accessKeyId: 'IKEAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    sessionToken: 'AQoEXAMPLEH4aoAH0gNCAPyJxzrBlCFFxWNE1OPTgk5TthT...'
  }
};

export const formatterTestData = {
  secretManagerReferenceEntries: [
    {
      key: 'APP_ENVIRONMENT',
      value: 'projectname-dev-shared-vars:APP_ENVIRONMENT',
      type: 'aws_secret_reference' as const
    },
    { key: 'NODE_ENV', value: 'development', type: 'direct_value' as const },
    {
      key: 'DATABASE_URL',
      value: 'projectname-dev-bfb:DATABASE_CONNECTION_STRING',
      type: 'aws_secret_reference' as const
    },
    {
      key: 'AWS_REGION',
      value: 'ap-northeast-1',
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
      APP_ENVIRONMENT: 'projectname-dev-shared-vars:APP_ENVIRONMENT'
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
    mockSTSClient.send.mockReset();
    mockGetCallerIdentityCommand.mockReset();
  }
};
