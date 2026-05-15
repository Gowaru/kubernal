import { describe, it, expect } from "vitest";

describe("API Health Check", () => {
  it("should return 200 on health endpoint", async () => {
    const res = await fetch("http://localhost:4000/health");
    const body = (await res.json()) as { status: string; service: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("kubernal-api");
  });
});
