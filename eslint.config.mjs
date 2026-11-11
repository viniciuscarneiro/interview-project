import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const testOnlyImports = {
  group: [
    '**/*.spec.*',
    '**/*.e2e-spec.*',
    '**/test/**',
    '**/__tests__/**',
    '@nestjs/testing',
    'supertest',
    'jest',
    '@jest/*',
    'node:test',
  ],
  message: 'Production code must not depend on tests or test frameworks.',
};

const explicitRepresentations = [
  {
    selector: 'ImportExpression',
    message: 'Feature dependencies must use static imports so layer boundaries remain auditable.',
  },
  {
    selector: 'TSImportEqualsDeclaration',
    message: 'Use static ESM imports so layer boundaries remain auditable.',
  },

  {
    selector: 'TSAsExpression:not([typeAnnotation.typeName.name="const"])',
    message: 'Narrow or adapt values explicitly; casts must not bypass model boundaries.',
  },
  {
    selector: 'TSTypeAssertion',
    message: 'Narrow or adapt values explicitly instead of asserting a representation.',
  },
];
const environmentBoundary = {
  object: 'process',
  property: 'env',
  message: 'Parse environment in config and inject typed values at composition.',
};

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'src/generated/**', 'node_modules/**', 'graphify-out/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [testOnlyImports] }],
    },
  },
  {
    files: ['src/modules/**/*.ts', 'src/infrastructure/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-properties': ['error', environmentBoundary],
      'no-restricted-syntax': ['error', ...explicitRepresentations],
    },
  },
  {
    files: ['src/modules/*/{model,logic,use-cases,wire,adapters}/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'process',
        'console',
        'fetch',
        'WebSocket',
        'crypto',
        'performance',
        'setTimeout',
        'setInterval',
        'queueMicrotask',
        'globalThis',
        'Buffer',
      ],
      'no-restricted-properties': [
        'error',
        environmentBoundary,
        {
          object: 'Date',
          property: 'now',
          message: 'Time must enter the core explicitly through a port or parameter.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Random identifiers belong at an effect boundary.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...explicitRepresentations,
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
          message: 'Use an explicit timestamp; ambient time is an effect.',
        },
        {
          selector: 'TSQualifiedName[left.name=/^(NodeJS|Express)$/]',
          message: 'Core and representation contracts cannot depend on ambient vendor namespaces.',
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    ignores: [
      'src/modules/*/{model,logic,use-cases,wire,adapters}/**/*.ts',
      'src/modules/*/diplomat/{http,database,crypto,cli}/**/*.ts',
      'src/modules/*/*.module.ts',
      'src/modules/*/*.tokens.ts',
      '**/*.spec.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...explicitRepresentations,
        {
          selector: 'Program',
          message:
            'Feature implementation must belong to a declared Diplomat layer; root files are composition modules or injection tokens.',
        },
      ],
    },
  },
  {
    files: ['src/modules/*/diplomat/{http,cli}/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: { 'no-restricted-globals': ['error', 'fetch', 'WebSocket', 'crypto', 'process'] },
  },
  {
    files: ['src/modules/*/adapters/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            testOnlyImports,
            {
              group: ['**/generated/prisma/client.js'],
              allowTypeImports: true,
              message:
                'Adapters may import generated representation types, not the runtime Prisma client. Runtime enums belong in generated/prisma/enums.js.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
