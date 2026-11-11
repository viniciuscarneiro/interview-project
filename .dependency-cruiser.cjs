const { readdirSync } = require('node:fs');
const { join } = require('node:path');

// Generate the same boundary rules for every feature, including newly added ones.
const features = readdirSync(join(__dirname, 'src/modules'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const actorContract = '^src/modules/auth/model/actor\\.ts$';
const authHttpContract = '^src/modules/auth/diplomat/http/auth\\.decorators\\.ts$';
function boundary(feature, name, from, allowed) {
  return {
    name: `${feature}-${name}`,
    severity: 'error',
    from: { path: from },
    to: { pathNot: allowed },
  };
}
const boundaries = features.flatMap((feature) => {
  const escapedFeature = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const root = `^src/modules/${escapedFeature}/`;
  return [
    boundary(feature, 'model-is-internal', `${root}model/`, `${root}model/`),
    boundary(feature, 'logic-is-pure', `${root}logic/`, `${root}(model|logic)/`),
    boundary(
      feature,
      'use-cases-use-own-core',
      `${root}use-cases/(?!ports/)`,
      `${root}(model/|logic/|use-cases/ports/|use-cases/[^/]+\\.errors\\.ts$)`,
    ),
    boundary(
      feature,
      'ports-use-internal-contracts',
      `${root}use-cases/ports/`,
      `${root}(model/|use-cases/ports/)`,
    ),
    boundary(
      feature,
      'wire-is-independent',
      `${root}wire/`,
      `(${root}wire/|^node_modules/(class-validator|class-transformer)/)`,
    ),
    boundary(
      feature,
      'adapters-only-map',
      `${root}adapters/`,
      `(${root}(model|wire|adapters)/|${actorContract}|^src/generated/prisma/)`,
    ),
    boundary(
      feature,
      'http-uses-application-boundaries',
      `${root}diplomat/http/`,
      `(${root}(wire/|model/|adapters/|use-cases/(?!ports/)|diplomat/http/)|${actorContract}|${authHttpContract}|^node_modules/(@nestjs|express|@types/express)/)`,
    ),
    boundary(
      feature,
      'cli-uses-application-boundaries',
      `${root}diplomat/cli/`,
      `${root}(wire/|model/|adapters/|use-cases/(?!ports/)|diplomat/cli/)`,
    ),
    boundary(
      feature,
      'database-implements-ports',
      `${root}diplomat/database/`,
      `(${root}(model/|adapters/|use-cases/ports/|diplomat/database/)|^src/(infrastructure/database|generated/prisma)/)`,
    ),
    boundary(
      feature,
      'crypto-implements-ports',
      `${root}diplomat/crypto/`,
      `(${root}(model/|wire/|adapters/|use-cases/ports/|diplomat/crypto/)|^(node:)?crypto$|^node_modules/(jose|class-validator)/)`,
    ),
  ];
});

module.exports = {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-unresolved-imports', severity: 'error', from: {}, to: { couldNotResolve: true } },
    ...boundaries,
    {
      name: 'http-does-not-access-persistence',
      severity: 'error',
      from: { path: '(^src/modules/[^/]+/diplomat/http/|^src/modules/.*\\.controller\\.ts$)' },
      to: {
        path: '(node_modules/(@prisma|pg)|src/generated/|src/infrastructure/database/|/diplomat/database/)',
      },
    },
    {
      name: 'configuration-does-not-depend-on-features',
      severity: 'error',
      from: { path: '^src/config/' },
      to: { path: '^src/(modules|infrastructure|generated)/' },
    },
    {
      name: 'infrastructure-does-not-own-features',
      severity: 'error',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'generated-records-stay-at-persistence-boundary',
      severity: 'error',
      from: {
        path: '^src/modules/',
        pathNot: '/(diplomat/database/|adapters/[^/]+\\.persistence\\.adapter\\.ts$)',
      },
      to: { path: '^src/generated/' },
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
