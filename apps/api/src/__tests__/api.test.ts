import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../shared/database.js", () => {
  const mockFindMany = vi.fn().mockResolvedValue([]);
  const mockFindUnique = vi.fn().mockResolvedValue(null);
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  return {
    db: {
      user: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      team: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      goldenPathTemplate: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      application: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      environment: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      deployment: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      pipeline: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
      securityPolicy: { findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate, update: mockUpdate, delete: mockDelete },
    },
  };
});

import { createApp } from "../app.js";

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("kubernal-api");
  });
});

describe("GET /api/v1/health", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
  });
});

describe("GET /not-found", () => {
  it("returns 404", async () => {
    const res = await request(app).get("/not-found");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("Users API", () => {
  it("GET /api/v1/users returns empty list", async () => {
    const res = await request(app).get("/api/v1/users");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("POST /api/v1/users validates required fields", async () => {
    const res = await request(app).post("/api/v1/users").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/users validates email format", async () => {
    const res = await request(app).post("/api/v1/users").send({ email: "bad", name: "Test" });
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/users/:id returns 400 for invalid UUID", async () => {
    const res = await request(app).get("/api/v1/users/not-a-uuid");
    expect(res.status).toBe(404);
  });
});

describe("Deployments API", () => {
  it("GET /api/v1/deployments returns empty list", async () => {
    const res = await request(app).get("/api/v1/deployments");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("POST /api/v1/deployments validates required fields", async () => {
    const res = await request(app).post("/api/v1/deployments").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/deployments rejects invalid UUIDs", async () => {
    const res = await request(app).post("/api/v1/deployments").send({
      applicationId: "bad",
      environmentId: "bad",
      version: "1.0",
      commitSha: "abc",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/deployments/:id/transition validates status", async () => {
    const res = await request(app).post("/api/v1/deployments/some-id/transition").send({ status: "invalid" });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/deployments/:id/transition rejects 'pending' target", async () => {
    const res = await request(app).post("/api/v1/deployments/some-id/transition").send({ status: "pending" });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/deployments/:id/approve validates UUID", async () => {
    const res = await request(app).post("/api/v1/deployments/some-id/approve").send({ approvedById: "bad" });
    expect(res.status).toBe(400);
  });
});

describe("Teams API", () => {
  it("GET /api/v1/teams returns empty list", async () => {
    const res = await request(app).get("/api/v1/teams");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("POST /api/v1/teams validates required fields", async () => {
    const res = await request(app).post("/api/v1/teams").send({});
    expect(res.status).toBe(400);
  });
});

describe("Templates API", () => {
  it("GET /api/v1/templates returns empty list", async () => {
    const res = await request(app).get("/api/v1/templates");
    expect(res.status).toBe(200);
  });
});

describe("Applications API", () => {
  it("GET /api/v1/applications returns empty list", async () => {
    const res = await request(app).get("/api/v1/applications");
    expect(res.status).toBe(200);
  });

  it("POST /api/v1/applications validates required fields", async () => {
    const res = await request(app).post("/api/v1/applications").send({});
    expect(res.status).toBe(400);
  });
});

describe("Environments API", () => {
  it("GET /api/v1/environments returns empty list", async () => {
    const res = await request(app).get("/api/v1/environments");
    expect(res.status).toBe(200);
  });
});

describe("Pipelines API", () => {
  it("GET /api/v1/pipelines returns empty list", async () => {
    const res = await request(app).get("/api/v1/pipelines");
    expect(res.status).toBe(200);
  });
});

describe("Policies API", () => {
  it("GET /api/v1/policies returns empty list", async () => {
    const res = await request(app).get("/api/v1/policies");
    expect(res.status).toBe(200);
  });
});
