import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'jsx'],
  rootDir: '.',
  testRegex: '(src/.*\\.spec\\.ts$|test/integration/.*\\.spec\\.ts$)',
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
  testEnvironment: 'node',
  testTimeout: 20000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!**/*.module.ts',
    '!**/__tests__/**',
    '!src/modules/omnichannel/integrations/channel-adapter.interface.ts',
  ],
  coverageDirectory: '../../coverage/server',
  coverageReporters: ['text-summary', 'lcov'],
  // Baseline 2026-10-03: global 76.1/62.99/73.25/77.09, commerce 75.4 lines /
  // 62.0 branches — thresholds sit 2 points under baseline and ratchet upward.
  coverageThreshold: {
    global: {
      statements: 74,
      branches: 60,
      functions: 71,
      lines: 75,
    },
    './src/modules/commerce/**/*.ts': {
      lines: 73,
      branches: 60,
    },
  },
  moduleNameMapper: {
    '^@sales-copilot/shared-contracts$': '<rootDir>/../../packages/shared-contracts/src/index.ts',
    '^@sales-copilot/shared-contracts/(.*)$': '<rootDir>/../../packages/shared-contracts/src/$1',
    '^@sales-copilot/email-templates$': '<rootDir>/../../packages/email-templates/src/index.ts',
    '^@sales-copilot/email-templates/(.*)$': '<rootDir>/../../packages/email-templates/src/$1',
  },
};

export default config;
