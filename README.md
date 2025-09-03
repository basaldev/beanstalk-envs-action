# Beanstalk Envs Action

![CI](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action creates `envvars.config` files for AWS Elastic Beanstalk deployments with support for both direct environment variables and AWS Secrets Manager integration.

## Features

- **Flexible Configuration**: Accepts JSON inputs and environment variable definitions directly in the workflow
- **AWS Secrets Manager Integration**: Automatically resolves secrets from AWS Secrets Manager using partial ARN references
- **Customizable File Placement**: Allows setting the directory and filename for the configuration file
- **Sorting**: Optionally sorts environment variable keys alphabetically
- **Error Handling**: Can be configured to fail the action if any environment variable is empty
- **Test Configuration**: Generates test configuration files with resolved secret values for validation
- **AWS Credentials**: Supports both IAM role credentials and explicit AWS credentials

## Inputs

### Basic Configuration
- `filename`: The filename for the environment file. Default is `envvars.config`
- `directory`: The directory to place the environment file. Default is `.ebextensions`
- `sort_keys`: Sort the keys alphabetically. Default is `false`
- `fail_on_empty`: Whether to fail the action if an environment variable is empty. Default is `false`

### Environment Variables
- `json`: JSON representation of your environment variable key/values for direct values
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

- `result`: The generated ebextensions envvars.config file
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

### AWS Secrets Manager Integration

```yaml
steps:
  - name: Generate EnvVars Config with Secrets
    uses: basaldev/beanstalk-envs-action@main
    with:
      aws_secret_references: '{"DB_PASSWORD": "myapp:db_password", "API_KEY": "myapp:api_key"}'
      aws_region: 'us-east-1'
      directory: '.ebextensions'
      filename: 'envvars.config'
      fail_on_empty: 'true'
      sort_keys: 'true'
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

### Direct Values Output

```yaml
option_settings:
  - option_name: API_KEY
    value: your_api_key
  - option_name: OTHER_VAR
    value: some_value
```

### Secrets Manager Output

```yaml
option_settings:
  - option_name: DB_PASSWORD
    value: "{{resolve:secretsmanager:myapp:SecretString:db_password}}"
  - option_name: API_KEY
    value: "{{resolve:secretsmanager:myapp:SecretString:api_key}}"
```

### Test Configuration Output

When `rendered_file_path` is provided, a test file is generated with resolved values:

```yaml
option_settings:
  - option_name: DB_PASSWORD
    value: "actual_resolved_secret_value"
  - option_name: API_KEY
    value: "actual_resolved_secret_value"
```

## AWS Secrets Manager Format

The `aws_secret_references` input expects a JSON object where:
- **Keys** are the environment variable names
- **Values** are in the format `"secretName:secretKey"`

For example:
```json
{
  "DB_PASSWORD": "myapp:db_password",
  "API_KEY": "myapp:api_key"
}
```

This will generate:
- `DB_PASSWORD` environment variable that references the `db_password` key from the `myapp` secret
- `API_KEY` environment variable that references the `api_key` key from the `myapp` secret

## Requirements

- **Node.js**: Version 20 or higher
- **AWS Permissions**: When using Secrets Manager, the action needs permissions to read secrets
- **AWS Region**: Must be specified when using `aws_secret_references`

## Contributing

Contributions to the Beanstalk Env Action are welcome! Please read our contributing guidelines to get started.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
