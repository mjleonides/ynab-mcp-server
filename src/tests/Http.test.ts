import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Streamable HTTP transport", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    process.env.READ_ONLY = "true";
    vi.resetModules();
    const { createHttpApp } = await import("../http");

    server = createHttpApp("test-token").listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    delete process.env.READ_ONLY;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("rejects unauthenticated MCP requests", async () => {
    const [post, get, remove] = await Promise.all([
      fetch(`${baseUrl}/mcp`, { method: "POST", body: "{}" }),
      fetch(`${baseUrl}/mcp`),
      fetch(`${baseUrl}/mcp`, { method: "DELETE" }),
    ]);

    expect(post.status).toBe(401);
    expect(get.status).toBe(401);
    expect(remove.status).toBe(401);
  });

  it("allows health checks", async () => {
    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
  });

  it("initializes, lists read-only tools, and terminates a session", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: "Bearer test-token" } },
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await client.connect(transport);
    expect(transport.sessionId).toBeDefined();
    const sessionId = transport.sessionId!;

    const result = await client.request({ method: "tools/list", params: {} }, ListToolsResultSchema);
    expect(result.tools).toHaveLength(9);
    expect(result.tools.map((tool) => tool.name)).not.toContain("ynab_create_transaction");

    await transport.terminateSession();
    await client.close();

    const deletedSession = await fetch(`${baseUrl}/mcp`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: "Bearer test-token",
        "Mcp-Session-Id": sessionId,
      },
    });
    expect(deletedSession.status).toBe(400);
  });

  it("returns a JSON-RPC bad-request response for invalid sessions", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
        "Mcp-Session-Id": "unknown-session",
      },
      body: JSON.stringify({ method: "tools/list", params: {} }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
  });

  it("does not expose the legacy SSE endpoints", async () => {
    const [sse, message] = await Promise.all([
      fetch(`${baseUrl}/sse`, { headers: { Authorization: "Bearer test-token" } }),
      fetch(`${baseUrl}/message`, { method: "POST", headers: { Authorization: "Bearer test-token" } }),
    ]);

    expect(sse.status).toBe(404);
    expect(message.status).toBe(404);
  });
});
