/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Ciclo de import detectado — bug latente. Refatore extraindo a peça compartilhada.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'Arquivo sem importadores — provavelmente código morto ou esquecido.',
      from: {
        orphan: true,
        pathNot: [
          '\\.(spec|test)\\.(ts|tsx)$',
          '\\.d\\.ts$',
          // Next.js convention files são "consumidos" pelo framework, não por imports.
          'src/app/.+\\.(tsx|ts|css|ico)$',
          'src/middleware\\.ts$',
          // Configs no root.
          '^[^/]+\\.(config|cjs|mjs)\\.(ts|js|mjs|cjs)$',
          '^next\\.config\\.ts$',
          '^postcss\\.config\\.mjs$',
          '^vitest\\.config\\.ts$',
          '^eslint\\.config\\.mjs$',
          // Scripts standalone.
          '^scripts/',
          // Fixtures consumidas dinamicamente em specs.
          '/__fixtures__/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
