import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'jsx'],
  rootDir: '../..',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2022',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          skipLibCheck: true,
          jsx: 'react-jsx',
        },
        diagnostics: false,
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: '../../coverage/apps/server/e2e',
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  moduleNameMapper: {
    '^@sales-copilot/shared-contracts$': '<rootDir>/../../packages/shared-contracts/src/index.ts',
    '^@sales-copilot/shared-contracts/(.*)$': '<rootDir>/../../packages/shared-contracts/src/$1',
    '^@sales-copilot/email-templates$': '<rootDir>/../../packages/email-templates/src/index.ts',
    '^@sales-copilot/email-templates/(.*)$': '<rootDir>/../../packages/email-templates/src/$1',
  },
};

export default config;
