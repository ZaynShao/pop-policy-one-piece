import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@pop/shared-types$': '<rootDir>/../../../packages/shared-types/src',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!**/migrations/**'],
};

export default config;
