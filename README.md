# Beanstalk Envs Action

![CI](https://github.com/basal-luke/beanstalk-envs-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/basal-luke/beanstalk-envs-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/basal-luke/beanstalk-envs-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/basal-luke/beanstalk-envs-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/basal-luke/beanstalk-envs-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This GitHub Action allows for simple creation of `envvars.config` files for AWS
Elastic Beanstalk deployments.

## Features

- **Flexible Configuration**: Accepts JSON inputs and environment variable
  definitions directly in the workflow.
- **Customizable File Placement**: Allows setting the directory and filename for
  the configuration file.
- **Sorting**: Optionally sorts environment variable keys alphabetically.
- **Error Handling**: Can be configured to fail the action if any environment
  variable is empty.

## Inputs

- `filename`: The filename for the environment file. Default is
  `envvars.config`.
- `directory`: The directory to place the environment file. Default is
  `.ebextensions`.
- `fail_on_empty`: Whether to fail the action if an environment variable is
  empty. Default is `false`.
- `sort_keys`: Sort the keys alphabetically. Default is `false`.
- `json`: JSON representation of your environment variable key/values.
- `ebx_${VARIABLE_NAME}`: In addition to using json, you can also define your
  variables directly in yaml using the `ebx_` prefix.

## Outputs

- `result`: An ebextensions envvars.config file

```yaml
option_settings:
  - option_name: VARIABLE_1
    value: value_1
  - option_name: VARIABLE_2
    value: value_2
```

## Usage

### Basic Usage with JSON

To use this action with JSON configuration in your workflow, add the following
step:

```yaml
steps:
  - name: Generate EnvVars Config
    uses: basal-luke/beanstalk-envs-action@main
    with:
      json: '{"API_KEY": "your_api_key", "OTHER_VAR": "some_value"}'
      directory: '.ebextensions'
      filename: 'envvars.config'
      fail_on_empty: 'true'
      sort_keys: 'true'
```

#### Example Output

```yaml
option_settings:
  - option_name: API_KEY
    value: your_api_key
  - option_name: OTHER_VAR
    value: some_value
```

### Advanced Usage with Mixed JSON and Environment Variables

You can also mix JSON with direct environment variable settings in your GitHub
Actions workflow:

```yaml
steps:
  - name: Generate EnvVars Config
    uses: basal-luke/beanstalk-envs-action@main
    with:
      json: '{"API_KEY": "your_api_key"}'
      ebx_MY_VARIABLE: '123'
      directory: '.ebextensions'
      filename: 'envvars.config'
      fail_on_empty: 'true'
      sort_keys: 'true'
```

#### Example Output

```yaml
option_settings:
  - option_name: API_KEY
    value: your_api_key
  - option_name: MY_VARIABLE
    value: 123
```

## Contributing

Contributions to the Beanstalk Env Action are welcome! Please read our
contributing guidelines to get started.

## License

This project is licensed under the MIT License - see the LICENSE file for
details.
