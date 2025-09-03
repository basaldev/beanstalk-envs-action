# Beanstalk Envs Action

![CI](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action creates `envvars.config` files for AWS Elastic Beanstalk deployments with support for both direct environment variables and AWS Secrets Manager integration. The action intelligently generates deployment configurations that avoid CloudFormation's 4096 character limit by using AWS Elastic Beanstalk's native secrets integration.

## Features

- **Flexible Configuration**: Accepts JSON inputs and environment variable definitions directly in the workflow
- **AWS Secrets Manager Integration**: Automatically resolves secrets from AWS Secrets Manager using partial ARN references
- **CloudFormation Limit Compliance**: Generates deployment configs that stay within the 4096 character limit
- **Dual Config Generation**: Creates both deployment and test configuration files
- **Customizable File Placement**: Allows setting the directory and filename for the configuration file
- **Sorting**: Optionally sorts environment variable keys alphabetically
- **Error Handling**: Can be configured to fail the action if any environment variable is empty
- **AWS Credentials**: Supports both IAM role credentials and explicit AWS credentials

## The Problem Solved

The action addresses CloudFormation's 4096 character limit issue that occurs when:
- All environment variables are passed as direct values in deployment configs
- Even values from AWS Secrets Manager are embedded in JSON during deployment
- Combined JSON objects exceed the 4,096 byte limit when AWS processes them

## Solution: Dual Config Generation

The action generates two different configuration files:

1. **Deployment Config** (`.ebextensions/envvars.config`): Uses AWS Elastic Beanstalk's native secrets integration with proper namespaces
2. **Test Config** (`.ebextensions/envvars-test.config`): Contains resolved values for local testing and validation

## Inputs

### Basic Configuration
- `filename`: The filename for the environment file. Default is `envvars.config`
- `directory`: The directory to place the environment file. Default is `.ebextensions`
- `sort_keys`: Sort the keys alphabetically. Default is `false`
- `fail_on_empty`: Whether to fail the action if an environment variable is empty. Default is `false`

### Environment Variables
- `json`: JSON representation of your environment variable key/values for direct values (maintains backward compatibility)
- `ebx_${VARIABLE_NAME}`: Define variables directly in yaml using the `ebx_` prefix (legacy format)

### AWS Secrets Manager Integration
- `aws_secret_references`: JSON string containing AWS Secrets Manager partial references (format: `"secretName:secretKey"`)
- `aws_region`: AWS region for Secrets Manager ARNs (required when using `aws_secret_references`)
- `aws_access_key_id`: AWS access key ID (optional, uses IAM role credentials if not provided)
- `aws_secret_access_key`: AWS secret access key (optional, uses IAM role credentials if not provided)
- `aws_session_token`: AWS session token (optional, uses IAM role credentials if not provided)

### Test Configuration
- `rendered_file_path`: Path to generate test config file with resolved secret values (only when `aws_secret_references` input is provided)

## Outputs

- `result`: The generated ebextensions envvars.config file (deployment config)
- `test_config`: A test configuration file with resolved secret values (only when `rendered_file_path` is provided)

## Usage

### Basic Usage with JSON

```yaml
steps:
  - name: Generate EnvVars Config
    uses: basaldev/beanstalk-envs-action@main
    with:
      json: '{"API_KEY": "your_api_key", "OTHER_VAR": "some_value"}'
      directory: '.ebextensions'
      filename: 'envvars.config'
      fail_on_empty: 'true'
      sort_keys: 'true'
```

### AWS Secrets Manager Integration (Recommended)

```yaml
steps:
  - name: Generate Beanstalk Config
    uses: ./beanstalk-envs-action
    with:
      aws_secret_references: |
        {
          "APP_ENVIRONMENT": "myapp-dev-shared-vars:APP_ENVIRONMENT",
          "DATABASE_URL": "myapp-dev-database:DATABASE_CONNECTION_STRING"
        }
      json: |
        {
          "AWS_REGION": "ap-northeast-1",
          "NODE_OPTIONS": "--max-old-space-size=1536"
        }
      aws_region: 'ap-northeast-1'
      directory: '.ebextensions'
      filename: 'envvars.config'
      rendered_file_path: '.ebextensions/envvars-test.config'
```

### Mixed Direct Values and Secrets

```yaml
steps:
  - name: Generate EnvVars Config with Mixed Sources
    uses: basaldev/beanstalk-envs-action@main
    with:
      json: '{"ENVIRONMENT": "production", "DEBUG": "false"}'
      aws_secret_references: '{"DB_PASSWORD": "myapp:db_password"}'
      aws_region: 'us-east-1'
      directory: '.ebextensions'
      filename: 'envvars.config'
      fail_on_empty: 'true'
      sort_keys: 'true'
```

### With Test Configuration

```yaml
steps:
  - name: Generate EnvVars Config with Test File
    uses: basaldev/beanstalk-envs-action@main
    with:
      aws_secret_references: '{"DB_PASSWORD": "myapp:db_password"}'
      aws_region: 'us-east-1'
      rendered_file_path: '.ebextensions/envvars-test.config'
      directory: '.ebextensions'
      filename: 'envvars.config'
```

### Using AWS Credentials

```yaml
steps:
  - name: Generate EnvVars Config with AWS Credentials
    uses: basaldev/beanstalk-envs-action@main
    with:
      aws_secret_references: '{"DB_PASSWORD": "myapp:db_password"}'
      aws_region: 'us-east-1'
      aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
      aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      aws_session_token: ${{ secrets.AWS_SESSION_TOKEN }}
      directory: '.ebextensions'
      filename: 'envvars.config'
```

## Output Examples

### Deployment Config Output (envvars.config)

When using AWS Secrets Manager, the deployment config uses proper namespaces:

```yaml
option_settings:
  - namespace: aws:elasticbeanstalk:application:environmentsecrets
    option_name: APP_ENVIRONMENT
    value: arn:aws:secretsmanager:ap-northeast-1:${AWS::AccountId}:secret:myapp-dev-shared-vars:APP_ENVIRONMENT
  - namespace: aws:elasticbeanstalk:application:environment
    option_name: AWS_REGION
    value: ap-northeast-1
  - namespace: aws:elasticbeanstalk:application:environment
    option_name: NODE_OPTIONS
    value: --max-old-space-size=1536
```

### Direct Values Output (Legacy Format)

```yaml
option_settings:
  - option_name: API_KEY
    value: your_api_key
  - option_name: OTHER_VAR
    value: some_value
```

### Test Configuration Output (envvars-test.config)

When `rendered_file_path` is provided, a test file is generated with resolved values:

```yaml
option_settings:
  - option_name: APP_ENVIRONMENT
    value: dev
  - option_name: AWS_REGION
    value: ap-northeast-1
  - option_name: NODE_OPTIONS
    value: --max-old-space-size=1536
```

## AWS Secrets Manager Format

The `aws_secret_references` input expects a JSON object where:
- **Keys** are the environment variable names
- **Values** are in the format `"secretName:secretKey"`

For example:
```json
{
  "APP_ENVIRONMENT": "myapp-dev-shared-vars:APP_ENVIRONMENT",
  "DATABASE_URL": "myapp-dev-database:DATABASE_CONNECTION_STRING"
}
```

This will generate:
- `APP_ENVIRONMENT` environment variable that references the `APP_ENVIRONMENT` key from the `myapp-dev-shared-vars` secret
- `DATABASE_URL` environment variable that references the `DATABASE_CONNECTION_STRING` key from the `myapp-dev-database` secret

## How It Works

1. **Secrets Processing**: AWS Secrets Manager references are converted to full ARNs with `${AWS::AccountId}` placeholders
2. **Namespace Assignment**: Secrets get the `aws:elasticbeanstalk:application:environmentsecrets` namespace, direct values get `aws:elasticbeanstalk:application:environment`
3. **Character Limit Compliance**: By using ARN references instead of embedded values, the config stays well under the 4096 character limit
4. **Dual Generation**: Both deployment-ready and test-ready configurations are generated for different use cases

## Requirements

- **Node.js**: Version 20 or higher
- **AWS Permissions**: When using Secrets Manager, the action needs permissions to read secrets
- **AWS Region**: Must be specified when using `aws_secret_references`
- **Elastic Beanstalk**: Requires Elastic Beanstalk environment that supports the `aws:elasticbeanstalk:application:environmentsecrets` namespace

## Contributing

Contributions to the Beanstalk Env Action are welcome! Please read our contributing guidelines to get started.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
