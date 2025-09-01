import {
  ebextensionsEnvVarsSecretManagerFormatter,
  ebextensionsEnvVarsDefaultFormatter
} from '../src/formatters';

import { formatterTestData } from './mocks';

describe('ebextensionsEnvVarsSecretManagerFormatter', () => {
  const mockEntries = formatterTestData.secretManagerReferenceEntries;

  it('should format AWS secret references with correct namespace', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      'ap-northeast-1'
    );

    expect(result).toContain(
      'namespace: aws:elasticbeanstalk:application:environmentsecrets'
    );
    expect(result).toContain('option_name: APP_ENVIRONMENT');
    expect(result).toContain(
      'arn:aws:secretsmanager:ap-northeast-1:${AWS::AccountId}:secret:projectname-dev-shared-vars:APP_ENVIRONMENT'
    );
  });

  it('should format direct values with correct namespace', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      'ap-northeast-1'
    );

    expect(result).toContain(
      'namespace: aws:elasticbeanstalk:application:environment'
    );
    expect(result).toContain('option_name: NODE_ENV');
    expect(result).toContain('value: development');
  });

  it('should generate valid YAML structure', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      'ap-northeast-1'
    );

    expect(result).toContain('option_settings:');
    expect(result).toMatch(
      / {2}- namespace: aws:elasticbeanstalk:application:environmentsecrets\n {4}option_name: APP_ENVIRONMENT\n {4}value: arn:aws:secretsmanager:ap-northeast-1:\$\{AWS::AccountId\}:secret:projectname-dev-shared-vars:APP_ENVIRONMENT/
    );
    expect(result).toMatch(
      / {2}- namespace: aws:elasticbeanstalk:application:environment\n {4}option_name: NODE_ENV\n {4}value: development/
    );
  });

  it('should handle different AWS regions', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      'eu-west-1'
    );

    expect(result).toContain(
      'arn:aws:secretsmanager:eu-west-1:${AWS::AccountId}:secret:projectname-dev-shared-vars:APP_ENVIRONMENT'
    );
  });
});

describe('ebextensionsEnvVarsDefaultFormatter', () => {
  const mockEntries = formatterTestData.defaultDirectValueEntries;

  it('should format entries in legacy format', () => {
    const result = ebextensionsEnvVarsDefaultFormatter(mockEntries);

    expect(result).toContain('option_settings:');
    expect(result).toContain('  - option_name: APP_ENVIRONMENT');
    expect(result).toContain('    value: development');
    expect(result).toContain('  - option_name: NODE_ENV');
    expect(result).toContain('    value: development');
  });

  it('should maintain correct YAML structure', () => {
    const result = ebextensionsEnvVarsDefaultFormatter(mockEntries);

    const lines = result.split('\n');
    expect(lines[0]).toBe('option_settings:');
    expect(lines[1]).toBe('  - option_name: APP_ENVIRONMENT');
    expect(lines[2]).toBe('    value: development');
  });
});
