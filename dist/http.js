import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server.js";
export function createHttpApp(authToken) {
    const app = express();
    const transports = new Map();
    const requireAuth = (req, res, next) => {
        if (req.get("authorization") !== `Bearer ${authToken}`) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        next();
    };
    app.get("/healthz", (_req, res) => res.sendStatus(200));
    app.use(express.json());
    app.post("/mcp", requireAuth, async (req, res, next) => {
        const sessionId = req.get("mcp-session-id");
        let transport = sessionId ? transports.get(sessionId) : undefined;
        try {
            if (!transport && !sessionId && isInitializeRequest(req.body)) {
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: randomUUID,
                    onsessioninitialized: (initializedSessionId) => {
                        transports.set(initializedSessionId, transport);
                    },
                });
                transport.onclose = () => {
                    if (transport?.sessionId)
                        transports.delete(transport.sessionId);
                };
                await createMcpServer().connect(transport);
            }
            if (!transport) {
                res.status(400).json({
                    jsonrpc: "2.0",
                    error: { code: -32000, message: "Bad Request: No valid session ID provided" },
                    id: null,
                });
                return;
            }
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            next(error);
        }
    });
    const handleSessionRequest = async (req, res, next) => {
        const sessionId = req.get("mcp-session-id");
        const transport = sessionId ? transports.get(sessionId) : undefined;
        if (!transport) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Bad Request: No valid session ID provided" },
                id: null,
            });
            return;
        }
        try {
            await transport.handleRequest(req, res);
        }
        catch (error) {
            next(error);
        }
    };
    app.get("/mcp", requireAuth, handleSessionRequest);
    app.delete("/mcp", requireAuth, handleSessionRequest);
    return app;
}
