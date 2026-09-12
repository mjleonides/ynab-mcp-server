import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpApp } from "../http";

describe("HTTP transport", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createHttpApp("test-token").listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("rejects unauthenticated MCP endpoints", async () => {
    const [sse, message] = await Promise.all([
      fetch(`${baseUrl}/sse`),
      fetch(`${baseUrl}/message`, { method: "POST", body: "{}" }),
    ]);

    expect(sse.status).toBe(401);
    expect(message.status).toBe(401);
  });

  it("allows health checks and authenticated message requests", async () => {
    const [health, message] = await Promise.all([
      fetch(`${baseUrl}/healthz`),
      fetch(`${baseUrl}/message`, {
        method: "POST",
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        body: "{}",
      }),
    ]);

    expect(health.status).toBe(200);
    expect(message.status).toBe(400);
  });

  it("establishes an authenticated SSE stream", async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/sse`, {
      headers: { Authorization: "Bearer test-token" },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
  });
});
