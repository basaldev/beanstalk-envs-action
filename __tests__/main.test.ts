/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core';
import * as main from '../src/main';
import * as constants from '../src/constants';

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  promises: {
    access: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue('')
  }
}));

const runMock = jest.spyOn(main, 'run');

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>;
let errorMock: jest.SpiedFunction<typeof core.error>;
let getInputMock: jest.SpiedFunction<typeof core.getInput>;
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>;
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>;

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    debugMock = jest.spyOn(core, 'debug').mockImplementation();
    errorMock = jest.spyOn(core, 'error').mockImplementation();
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation();
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation();
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation();
  });

  it('should use default directory and filename', async () => {
    const defaultDirectory = '.ebextensions';
    const defaultFilename = 'envvars.config';
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return JSON.stringify({ mock_key: 'mock_value' });
        default:
          return '';
      }
    });

    await main.run();
    expect(runMock).toHaveReturned();

    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      `Creating file: ${defaultDirectory}/${defaultFilename}`
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('should use user inputted values for directory and filename', async () => {
    const userSpecifiedDirectory = 'some-directory';
    const userSpecifiedFilename = 'secrets';
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return JSON.stringify({ mock_key: 'mock_value' });
        case 'directory':
          return userSpecifiedDirectory;
        case 'filename':
          return userSpecifiedFilename;
        default:
          return '';
      }
    });

    await main.run();
    expect(runMock).toHaveReturned();

    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      `Creating file: ${userSpecifiedDirectory}/${userSpecifiedFilename}`
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('should user output user inputted json values to file', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return JSON.stringify({ HELLO: 'WORLD' });
        default:
          return '';
      }
    });

    await main.run();
    expect(runMock).toHaveReturned();

    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining('HELLO')
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('should output user inputted yaml entries to file', async () => {
    const mockValue = 'yaml_test';
    const mockKey = 'MY_YAML_KEY';
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return '';
        default:
          return '';
      }
    });

    process.env[`${constants.YAML_ENTRY_PREFIX}${mockKey}`] = mockValue;

    await main.run();
    expect(runMock).toHaveReturned();

    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining(mockValue)
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('should output user both json and yaml entries to file', async () => {
    const mockYamlKey = 'MY_YAML_KEY';
    const mockYamlValue = 'yaml_test';
    const mockJson = { MY_JSON_KEY: 'json_test' };

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return JSON.stringify(mockJson);
        default:
          return '';
      }
    });

    process.env[`${constants.YAML_ENTRY_PREFIX}${mockYamlKey}`] = mockYamlValue;

    await main.run();
    expect(runMock).toHaveReturned();

    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining(`value: ${mockYamlValue}`)
    );

    expect(setOutputMock).toHaveBeenNthCalledWith(
      1,
      'result',
      expect.stringContaining(`value: ${mockJson.MY_JSON_KEY}`)
    );

    expect(errorMock).not.toHaveBeenCalled();
  });

  it('should throw an error due to a single duplicate key being defined', async () => {
    const mockYamlKey = 'MY_DUPLICATE_KEY';
    const mockYamlValue = 'yaml_test';
    const mockJson = { MY_DUPLICATE_KEY: 'json_test' };

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return JSON.stringify(mockJson);
        default:
          return '';
      }
    });

    process.env[`${constants.YAML_ENTRY_PREFIX}${mockYamlKey}`] = mockYamlValue;

    await main.run();
    expect(errorMock).toHaveBeenCalledWith(
      '[extractEntries] Error: Duplicate keys detected (MY_DUPLICATE_KEY)'
    );
    expect(setFailedMock).toHaveBeenCalledWith(
      '[main] Error: No valid entries were found'
    );
  });

  it('should throw an error due to multiple duplicate keys being defined', async () => {
    const mockYamlKey = 'MY_DUPLICATE_KEY';
    const anotherMockYamlKey = 'ANOTHER_DUPLICATE_KEY';
    const mockYamlValue = 'yaml_test';
    const mockJson = {
      MY_DUPLICATE_KEY: 'json_test',
      ANOTHER_DUPLICATE_KEY: 'mock_value'
    };

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'json':
          return JSON.stringify(mockJson);
        default:
          return '';
      }
    });

    process.env[`${constants.YAML_ENTRY_PREFIX}${mockYamlKey}`] = mockYamlValue;
    process.env[`${constants.YAML_ENTRY_PREFIX}${anotherMockYamlKey}`] =
      mockYamlValue;

    await main.run();
    expect(errorMock).toHaveBeenCalledWith(
      '[extractEntries] Error: Duplicate keys detected (MY_DUPLICATE_KEY,ANOTHER_DUPLICATE_KEY)'
    );
    expect(setFailedMock).toHaveBeenCalledWith(
      '[main] Error: No valid entries were found'
    );
  });
});
