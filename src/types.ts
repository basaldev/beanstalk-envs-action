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
 * AWS Secrets Manager SecretString
 * Maps secret names to their parsed JSON key-value pairs
 * @example
 * {
 *   "projectname-dev-shared-shopify-vars": {
 *     "SHOPIFY_PRODUCT_VARIANT_ABC": "19191919191919",
 *     "SHOPIFY_PRODUCT_VARIANT_DEF": "19191919191918"
 *   }
 * }
 */
export type AWSSecretStringData = Record<
  string,
  Record<string, string | number | boolean>
>;
