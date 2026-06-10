# {{name}}

{{description}}

## Quick Start

```bash
npm install
npm start
```

## Endpoints

- `GET /health` — Health check
- `GET /` — Service info

## Docker

```bash
docker build -t {{name}} .
docker run -p {{port}}:{{port}} {{name}}
```

## Deployed with Kubernal

This project was scaffolded by the Kubernal Internal Developer Platform.
