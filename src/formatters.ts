import { ENVVARS_FILE_HEADER } from './constants';
import { Entry, ClassifiedEntry } from './types';

/**
 * Format data into envvars.config format with AWS Secrets Manager references and direct values
 *
 * @example
 * Input:
 * entries: [
 *   { key: "SHOPIFY_PRODUCT_VARIANT_ABC", value: "projectname-dev-shared-shopify-vars", type: "aws_secret_reference" },
 *   { key: "AWS_REGION", value: "ap-northeast-1", type: "direct_value" }
 * ]
 * arns: {
 *   "projectname-dev-shared-shopify-vars": "arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN"
 * }
 *
 * Output:
 * option_settings:
 *   - namespace: aws:elasticbeanstalk:application:environmentsecrets
 *     option_name: SHOPIFY_PRODUCT_VARIANT_ABC
 *     value: arn:aws:secretsmanager:ap-northeast-1:112233445566:secret:projectname-dev-shared-shopify-vars-xOr0aN
 *   - namespace: aws:elasticbeanstalk:application:environment
 *     option_name: AWS_REGION
 *     value: ap-northeast-1
 *
 * @param entries - Array of classified entries
 * @param arns - Pre-fetched ARNs for each secret name
 * @returns Formatted config string
 */
export function ebextensionsEnvVarsSecretManagerFormatter(
  entries: ClassifiedEntry[],
  arns: Record<string, string>
): string {
  const optionSettings = entries.map(entry => {
    if (entry.type === 'aws_secret_reference') {
      const secretName = String(entry.value);
      const secretARN = arns[secretName];

      // Format as AWS Secrets Manager reference
      return `  - namespace: aws:elasticbeanstalk:application:environmentsecrets
    option_name: ${entry.key}
    value: ${secretARN}`;
    } else {
      // Format as direct environment variable
      return `  - namespace: aws:elasticbeanstalk:application:environment
    option_name: ${entry.key}
    value: ${entry.value}`;
    }
  });

  return `${ENVVARS_FILE_HEADER}${optionSettings.join('\n')}`;
}

/**
 * Format data into default envvars.config format
 *
 * @example
 * Input:
 * entries: [
 *   { key: "AWS_REGION", value: "ap-northeast-1" },
 *   { key: "NODE_ENV", value: "production" }
 * ]
 *
 * Output:
 * option_settings:
 *   - option_name: AWS_REGION
 *     value: ap-northeast-1
 *   - option_name: NODE_ENV
 *     value: production
 *
 * @param entries - Array of entries with key-value pairs
 * @returns Formatted config string
 */
export function ebextensionsEnvVarsDefaultFormatter(entries: Entry[]): string {
  return entries.reduce((prev, { key, value }) => {
    const name = `  - option_name: ${key}\n`;
    const valueStr = `    value: ${value}\n`;
    return prev + name + valueStr;
  }, ENVVARS_FILE_HEADER);
}
