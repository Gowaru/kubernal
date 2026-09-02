export const provisionInfrastructureDemoSteps = [
  {
    name: 'fetch-template',
    action: 'fetch:template',
    params: { repository: 'https://github.com/octocat/Hello-World' },
  },
  {
    name: 'provision-ns',
    action: 'provision:infrastructure',
    params: {
      applicationName: 'demo-app',
      environmentType: 'dev',
      teamNamespacePrefix: 'platform',
    },
  },
];
