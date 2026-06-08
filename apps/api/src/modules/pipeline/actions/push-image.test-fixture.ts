export const pushImageDemoSteps = [
  { name: 'build', action: 'build:image', params: { context: '/path/to/app', image: 'my-app:local' } },
  { name: 'push-ghcr', action: 'push:image', params: { image: 'my-app:local', targetImage: 'ghcr.io/owner/my-app:v1.0.0' } },
];