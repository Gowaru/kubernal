export const scanImageDemoSteps = [
  {
    name: 'build',
    action: 'build:image',
    params: { context: '/path/to/app', image: 'my-app:1.0.0' },
  },
  {
    name: 'scan',
    action: 'scan:image',
    params: { image: 'my-app:1.0.0', severity: ['CRITICAL', 'HIGH'], exitCode: true },
  },
];
