import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '(src/.*\\.spec\\.ts$|test/integration/.*\\.spec\\.ts$)',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2022',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        diagnostics: false,
      },
    ],
  },
  testEnvironment: 'node',
  testTimeout: 20000,
  moduleNameMapper: {
    '^@sales-copilot/shared-contracts$': '<rootDir>/../../packages/shared-contracts/src/index.ts',
    '^@sales-copilot/shared-contracts/(.*)$': '<rootDir>/../../packages/shared-contracts/src/$1',
  },
};

export default config;
