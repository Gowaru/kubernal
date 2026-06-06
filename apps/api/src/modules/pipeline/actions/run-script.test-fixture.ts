export const runScriptDemoSteps = [
  { name: 'fetch-template', action: 'fetch:template', params: { repository: 'https://github.com/octocat/Hello-World' } },
  { name: 'list-repo', action: 'run:script', params: { command: 'ls', args: ['-la'] } },
  { name: 'count-files', action: 'run:script', params: { command: 'find', args: ['.', '-type', 'f'] } },
];
