import { afterEach, describe, expect, it, vi } from "vitest";

const registeredTools: string[] = [];

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool(name: string) {
      registeredTools.push(name);
    }
  },
}));

vi.mock("ynab", () => ({
  API: class {},
}));

afterEach(() => {
  delete process.env.READ_ONLY;
  registeredTools.length = 0;
  vi.resetModules();
});

describe("createMcpServer", () => {
  it("excludes every mutation tool when READ_ONLY=true", async () => {
    process.env.READ_ONLY = "true";
    const { createMcpServer } = await import("../server");

    createMcpServer();

    expect(registeredTools).toHaveLength(9);
    expect(registeredTools).not.toContain("ynab_create_transaction");
    expect(registeredTools).not.toContain("ynab_update_transaction");
    expect(registeredTools).not.toContain("ynab_delete_transaction");
    expect(registeredTools).not.toContain("ynab_import_transactions");
    expect(registeredTools).not.toContain("ynab_approve_transaction");
    expect(registeredTools).not.toContain("ynab_bulk_approve_transactions");
    expect(registeredTools).not.toContain("ynab_update_category_budget");
  });

  it("includes mutation tools when READ_ONLY is unset", async () => {
    const { createMcpServer } = await import("../server");

    createMcpServer();

    expect(registeredTools).toHaveLength(16);
    expect(registeredTools).toContain("ynab_create_transaction");
  });
});
