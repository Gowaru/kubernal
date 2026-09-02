export const deployManifestDemoSteps = [
  {
    name: 'build',
    action: 'build:image',
    params: { context: '/path/to/app', image: 'my-app:1.0.0' },
  },
  { name: 'deploy', action: 'deploy:manifest', params: { manifests: ['/path/to/manifests/'] } },
];
