module.exports = {
  forbidden: [
    {
      name: 'engines-are-pure',
      severity: 'error',
      from: { path: '^src/engines/' },
      to: { path: '^src/(modules|infrastructure|integrations|config|generated)/|@nestjs' },
    },
    {
      name: 'common-does-not-depend-on-modules',
      severity: 'error',
      from: { path: '^src/common/' },
      to: { path: '^src/(modules|infrastructure|integrations)/' },
    },
    {
      name: 'infrastructure-does-not-depend-on-modules',
      severity: 'error',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'integrations-only-through-ports',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: '\\.module\\.ts$' },
      to: { path: '^src/integrations/.+/(?!.*\\.port\\.ts$)[^/]+\\.ts$' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.spec\\.ts$', '\\.d\\.ts$', '^src/generated/', '^src/(main|worker)\\.ts$', '^src/scripts/'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/generated/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
