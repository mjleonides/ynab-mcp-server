#!/usr/bin/env node
import { createHttpApp } from "./http.js";
import { isReadOnly } from "./server.js";
async function main() {
    const authToken = process.env.MCP_AUTH_TOKEN;
    if (!authToken) {
        throw new Error("MCP_AUTH_TOKEN is required for the HTTP server");
    }
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535");
    }
    const host = process.env.HOST || "0.0.0.0";
    createHttpApp(authToken).listen(port, host, () => {
        if (isReadOnly) {
            console.log("READ_ONLY=true: Mutation tools have been disabled.");
        }
        else {
            console.warn("WARNING: READ_ONLY is false or unset. Mutation tools are enabled.");
        }
        console.log(`YNAB MCP server listening on http://${host}:${port}/sse`);
    });
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
