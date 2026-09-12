import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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
    app.get("/sse", requireAuth, async (_req, res, next) => {
        try {
            const transport = new SSEServerTransport("/message", res);
            transports.set(transport.sessionId, transport);
            transport.onclose = () => transports.delete(transport.sessionId);
            await createMcpServer().connect(transport);
        }
        catch (error) {
            next(error);
        }
    });
    app.post("/message", requireAuth, async (req, res, next) => {
        const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
        const transport = sessionId ? transports.get(sessionId) : undefined;
        if (!transport) {
            res.status(400).json({ error: "No transport found for sessionId" });
            return;
        }
        try {
            await transport.handlePostMessage(req, res, req.body);
        }
        catch (error) {
            next(error);
        }
    });
    return app;
}
