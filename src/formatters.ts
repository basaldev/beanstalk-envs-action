import { ENVVARS_FILE_HEADER } from './constants';
import { Entry, ClassifiedEntry } from './types';


/**
 * Convert a secret reference string to AWS Secrets Manager ARN
 * @param secretPath - Format example: "projectname-dev-shared-vars:APP_ENVIRONMENT"
 * @returns AWS Secrets Manager ARN
 */
function convertToSecretsManagerARN(secretPath: string, awsRegion: string): string {
  // Extract secret name and key from secret reference string
  // (example: "projectname-dev-shared-vars:APP_ENVIRONMENT" -> "projectname-dev-shared-vars", "APP_ENVIRONMENT")
  const [secretName, secretKey] = secretPath.split(':');
  
  // Format: arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:secretName:secretKey
  return `arn:aws:secretsmanager:${awsRegion}:\${AWS::AccountId}:secret:${secretName}:${secretKey}`;
}

/**
 * Format data into envvars.config format with AWS Secrets Manager references and direct values
 * @param entries - Array of classified entries
 * @returns Formatted config string
 */
export function ebextensionsEnvVarsSecretManagerFormatter(
  entries: ClassifiedEntry[],
  awsRegion: string 
): string {
  const optionSettings = entries.map(entry => {
    if (entry.type === 'aws_secret_reference') {
      // Format as AWS Secrets Manager reference
      return `  - namespace: aws:elasticbeanstalk:application:environmentsecrets
    option_name: ${entry.key}
    value: ${convertToSecretsManagerARN(String(entry.value), awsRegion)}`;
    } else {
      // Format as direct environment variable
      return `  - namespace: aws:elasticbeanstalk:application:environment
    option_name: ${entry.key}
    value: ${entry.value}`;
    }
  });

  return `${ENVVARS_FILE_HEADER}
option_settings:
${optionSettings.join('\n')}`;
}

/**
 * Format data into default envvars.config format
 * @param entries
 * @returns
 */
export function ebextensionsEnvVarsDefaultFormatter(entries: Entry[]): string {
  return entries.reduce((prev, { key, value }) => {
    const name = `  - option_name: ${key}\n`;
    const valueStr = `    value: ${value}\n`;
    return prev + name + valueStr;
  }, ENVVARS_FILE_HEADER);
}
