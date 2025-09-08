# Beanstalk Envs Action

![CI](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/ci.yml/badge.svg)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Builds Beanstalk config files from direct input, AWS Secrets Manager references, or both. 
Generates AWS Secrets Manager ARN references for secure environment variable management in Elastic Beanstalk.
Can also output a local test config file with resolved values for testing before deployment.

## Quick Start

```yaml
steps:
  - name: Generate Config
    uses: basaldev/beanstalk-envs-action@main
    with:
      aws_secret_references: '{"DB_PASSWORD": "myapp-secrets"}'
      json: '{"ENVIRONMENT": "production"}'
      aws_region: 'us-east-1'
```

## Inputs

- `aws_secret_references`: JSON of AWS Secrets Manager references (format:
  `"ENV_NAME": "secretName"` - aws secret name)
- `json`: Direct environment variables
- `aws_region`: AWS region (required for secrets)
- `aws_access_key_id`: AWS access key ID (optional, uses IAM role if not
  provided)
- `aws_secret_access_key`: AWS secret access key (optional, uses IAM role if not
  provided)
- `aws_session_token`: AWS session token (optional, uses IAM role if not
  provided)
- `directory`: Output directory (default: `.ebextensions`)
- `filename`: Output filename (default: `envvars.config`)
- `rendered_file_path`: Optional local test config file path for testing
- `sort_keys`: Sort environment variables alphabetically (default: `false`)
- `fail_on_empty`: Fail if any environment variable is empty (default: `false`)

## Examples

### Direct Values Only

```yaml
json: '{"ENVIRONMENT": "production", "DEBUG": "false"}'
```

### AWS Secrets Manager Only

```yaml
aws_secret_references: '{"DB_PASSWORD": "myapp-secrets", "API_KEY": "myapp-secrets"}'
aws_region: 'us-east-1'
```

### Both Direct + AWS Secrets Manager

```yaml
aws_secret_references: '{"DB_PASSWORD": "myapp-secrets", "API_KEY": "myapp-secrets"}'
json: '{"ENVIRONMENT": "production", "DEBUG": "false"}'
aws_region: 'us-east-1'
```

### Test with Local Config File

```yaml
rendered_file_path: '.'
```

## How It Works

### AWS Secrets Manager Integration

The action fetches the full ARN from AWS Secrets Manager and uses it in the Beanstalk configuration:

**Input Format:**
```json
{
  "API_KEY": "myapp-secrets",
  "DB_PASSWORD": "myapp-secrets"
}
```

**Generated Output:**
```yaml
option_settings:
  - namespace: aws:elasticbeanstalk:application:environmentsecrets
    option_name: API_KEY
    value: arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp-secrets-AbCdEf
  - namespace: aws:elasticbeanstalk:application:environmentsecrets
    option_name: DB_PASSWORD
    value: arn:aws:secretsmanager:us-east-1:123456789012:secret:myapp-secrets-AbCdEf
```

## Output

- `.ebextensions/envvars.config` - Beanstalk deployment config with AWS Secrets Manager ARNs
- Optional `.ebextensions/envvars-test.config` - Test config with resolved values for local testing

## License

MIT
