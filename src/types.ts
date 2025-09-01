/**
 * Basic entry type for environment variables
 * @property key - Environment variable name
 * @property value - Environment variable value (string, boolean, or number)
 */
export type Entry = { key: string; value: string | boolean | number };

/**
 * Entry with explicit type classification
 * @property type - Type classification: 'aws_secret_reference' or 'direct_value'
 */
export type ClassifiedEntry = Entry & { 
  type: 'aws_secret_reference' | 'direct_value';
};

/**
 * Resolution status for aws secret entries
 */
export type ResolutionStatus = 'not_required' | 'success' | 'failed';

/**
 * Entry after aws secret resolution attempt
 * @property key - Environment variable name
 * @property resolvedValue - Final value after resolution (either resolved secret or fallback)
 * @property originalValue - Original value before resolution
 * @property resolutionStatus - Status of resolution: 'not_required', 'success', or 'failed'
 */
export type ResolvedEntry = {
  key: string;
  resolvedValue: string;
  originalValue: string;
  resolutionStatus: ResolutionStatus;
};

/**
 * AWS credentials and configuration
 * @property region - AWS region (e.g., 'ap-northeast-1')
 * @property accessKeyId - AWS access key ID
 * @property secretAccessKey - AWS secret access key
 * @property sessionToken - AWS session token
 */
export type AWSConfig = {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
};

/**
 * AWS client configuration for Secrets Manager
 * @property region - AWS region
 * @property credentials - Optional AWS credentials
 */
export type AWSClientConfig = {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
};

/**
 * aws secret resolution
 * @property key - Entry key (environment variable name)
 * @property secretKey - Actual AWS Secrets Manager key to look up
 * @property originalValue - Original secret reference string input
 */
export type SecretEntry = {
  key: string;
  secretKey: string;
  originalValue: string;
};

/**
 * Direct entry that doesn't need aws secret resolution
 * @property key - Environment variable name
 * @property value - Direct value (no resolution)
 * @property originalValue
 */
export type DirectEntry = {
  key: string;
  value: string;
  originalValue: string;
};

/**
 * Groups entries by aws secret category name
 */
export type SecretGroups = Record<string, SecretEntry[]>;
