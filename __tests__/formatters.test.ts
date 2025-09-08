import {
  ebextensionsEnvVarsSecretManagerFormatter,
  ebextensionsEnvVarsDefaultFormatter
} from '../src/formatters';

import { formatterTestData, testData } from './mocks';

describe('ebextensionsEnvVarsSecretManagerFormatter', () => {
  const mockEntries = testData.classifiedEntries;
  const mockArns = testData.arns;

  it('should format AWS secret references with correct namespace', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      mockArns
    );

    expect(result).toContain(
      'namespace: aws:elasticbeanstalk:application:environmentsecrets'
    );
    expect(result).toContain('option_name: SHOPIFY_PRODUCT_VARIANT_ABC');
    expect(result).toContain(
      'arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN'
    );
  });

  it('should format direct values with correct namespace', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      mockArns
    );

    expect(result).toContain(
      'namespace: aws:elasticbeanstalk:application:environment'
    );
    expect(result).toContain('option_name: AWS_REGION');
    expect(result).toContain('value: ap-northeast-1');
  });

  it('should generate valid YAML structure', () => {
    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      mockArns
    );

    expect(result).toContain('option_settings:');
    expect(result).toMatch(
      / {2}- namespace: aws:elasticbeanstalk:application:environmentsecrets\n {4}option_name: SHOPIFY_PRODUCT_VARIANT_ABC\n {4}value: arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN/
    );
    expect(result).toMatch(
      / {2}- namespace: aws:elasticbeanstalk:application:environment\n {4}option_name: AWS_REGION\n {4}value: ap-northeast-1/
    );
  });

  it('should handle different AWS regions and account IDs', () => {
    const differentArns = {
      'projectname-dev-shared-shopify-vars': 'arn:aws:secretsmanager:eu-west-1:987654321098:secret:projectname-dev-shared-shopify-vars-yPq1bM'
    };

    const result = ebextensionsEnvVarsSecretManagerFormatter(
      mockEntries,
      differentArns
    );

    expect(result).toContain(
      'arn:aws:secretsmanager:eu-west-1:987654321098:secret:projectname-dev-shared-shopify-vars-yPq1bM'
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
