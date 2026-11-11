module.exports = {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-unresolved-imports', severity: 'error', from: {}, to: { couldNotResolve: true } },
    {
      name: 'core-is-framework-and-io-independent',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(model|logic|use-cases)/' },
      to: {
        path: '(^node:|^node_modules/|^src/(infrastructure|config|generated)/|/(diplomat|adapters|wire)/)',
      },
    },
    {
      name: 'models-only-depend-on-models',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/model/' },
      to: { pathNot: '^src/modules/[^/]+/model/' },
    },
    {
      name: 'logic-only-depends-on-logic-and-models',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/logic/' },
      to: { pathNot: '^src/modules/[^/]+/(logic|model)/' },
    },
    {
      name: 'ports-only-depend-on-core-contracts',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/use-cases/ports/' },
      to: { pathNot: '^src/modules/[^/]+/(model/|use-cases/ports/)' },
    },
    {
      name: 'wire-does-not-import-domain-or-adapters',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/wire/' },
      to: { path: '^src/', pathNot: '^src/modules/[^/]+/wire/' },
    },
    {
      name: 'adapters-do-not-execute-effects-or-business-rules',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/adapters/' },
      to: { path: '(^node:|^node_modules/|^src/(infrastructure|config)/|/(diplomat|logic)/)' },
    },
    {
      name: 'http-does-not-access-persistence',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/diplomat/http/' },
      to: {
        path: '(node_modules/(@prisma|pg)|src/generated/|src/infrastructure/database/|/diplomat/database/)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules|src/generated' },
    exclude: { path: '\\.spec\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'node', 'default'],
    },
  },
};
