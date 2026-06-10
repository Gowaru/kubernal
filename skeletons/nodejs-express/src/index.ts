import express, { type Request, type Response } from 'express';

const app = express();
const PORT: number = {{port}};

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '{{name}}' });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ name: '{{name}}', description: '{{description}}' });
});

app.listen(PORT, () => {
  console.log(`{{name}} listening on port ${PORT}`);
});
