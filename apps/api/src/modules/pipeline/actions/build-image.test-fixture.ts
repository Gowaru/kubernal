import path from 'node:path';

const SAMPLE_APP_CONTEXT = path.resolve(process.cwd(), 'test-fixtures', 'sample-app');

export const buildImageDemoSteps = [
  {
    id: 'clone',
    name: 'Clone template repository',
    action: 'fetch:template',
    input: { repository: 'https://github.com/octocat/Hello-World' },
  },
  {
    id: 'build-sample',
    name: 'Build sample image from local Dockerfile',
    action: 'build:image',
    input: {
      context: SAMPLE_APP_CONTEXT,
      dockerfile: 'Dockerfile',
      image: 'kubernal-sample:13.3-demo',
      labels: { 'kubernal.io/build': 'demo', 'kubernal.io/phase': '13.3' },
    },
  },
];
