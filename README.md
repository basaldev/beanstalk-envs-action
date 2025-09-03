# Beanstalk Envs Action

![CI](https://github.com/basaldev/beanstalk-envs-action/actions/workflows/ci.yml/badge.svg)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Builds Beanstalk config files from direct input, AWS secrets, or both. Can also output a local .env file for testing before deployment.

## Quick Start

```yaml
steps:
  - name: Generate Config
    uses: basaldev/beanstalk-envs-action@main
    with:
      aws_secret_references: '{"DB_PASSWORD": "myapp:db_password"}'
      json: '{"ENVIRONMENT": "production"}'
      aws_region: 'us-east-1'
```

## Inputs

- `aws_secret_references`: JSON of secrets (format: `"ENV_NAME": "secretName:secretKey"`)
- `json`: Direct environment variables
- `aws_region`: AWS region (required for secrets)
- `aws_access_key_id`: AWS access key ID (optional, uses IAM role if not provided)
- `aws_secret_access_key`: AWS secret access key (optional, uses IAM role if not provided)
- `aws_session_token`: AWS session token (optional, uses IAM role if not provided)
- `directory`: Output directory (default: `.ebextensions`)
- `filename`: Output filename (default: `envvars.config`)
- `rendered_file_path`: Optional local .env file path for testing
- `sort_keys`: Sort environment variables alphabetically (default: `false`)
- `fail_on_empty`: Fail if any environment variable is empty (default: `false`)

## Examples

### Direct Values Only
```yaml
json: '{"ENVIRONMENT": "production", "DEBUG": "false"}'
```

### AWS Secrets Only
```yaml
aws_secret_references: '{"DB_PASSWORD": "myapp:db_password"}'
aws_region: 'us-east-1'
```

### Both Direct + Secrets
```yaml
aws_secret_references: '{"DB_PASSWORD": "myapp:db_password"}'
json: '{"ENVIRONMENT": "production", "DEBUG": "false"}'
aws_region: 'us-east-1'
```

### Test with Local .env
```yaml
rendered_file_path: '.env'
```

## Output

- `.ebextensions/envvars.config` - Beanstalk deployment config
- Optional `.env` file with actual values for local testing

## License

MIT
