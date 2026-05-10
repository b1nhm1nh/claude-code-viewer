import { describe, expect, it } from "vitest";
import { parseMcpListOutput } from "./parseMcpListOutput.ts";

describe("parseMcpListOutput", () => {
  it("should parse claude mcp list output correctly", () => {
    const output = `2.0.21 (Claude Code)
Checking MCP server health...

context7: npx -y @upstash/context7-mcp@latest - ✓ Connected
`;

    const result = parseMcpListOutput(output);

    expect(result).toEqual([
      {
        name: "context7",
        command: "npx -y @upstash/context7-mcp@latest",
        status: "connected",
      },
    ]);
  });

  it("should handle multiple MCP servers", () => {
    const output = `2.0.21 (Claude Code)
Checking MCP server health...

context7: npx -y @upstash/context7-mcp@latest - ✓ Connected
filesystem: /usr/local/bin/mcp-server-fs - ✓ Connected
database: docker run db-mcp - ✗ Failed
`;

    const result = parseMcpListOutput(output);

    expect(result).toEqual([
      {
        name: "context7",
        command: "npx -y @upstash/context7-mcp@latest",
        status: "connected",
      },
      {
        name: "filesystem",
        command: "/usr/local/bin/mcp-server-fs",
        status: "connected",
      },
      {
        name: "database",
        command: "docker run db-mcp",
        status: "failed",
      },
    ]);
  });

  it("should return empty array for output with no MCP servers", () => {
    const output = `2.0.21 (Claude Code)
Checking MCP server health...

`;

    const result = parseMcpListOutput(output);

    expect(result).toEqual([]);
  });

  it("should detect needs_auth status with bare URL command", () => {
    const output = `Checking MCP server health…

claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ! Needs authentication
`;

    const result = parseMcpListOutput(output);

    expect(result).toEqual([
      {
        name: "claude.ai Google Drive",
        command: "https://drivemcp.googleapis.com/mcp/v1",
        status: "needs_auth",
      },
    ]);
  });

  it("should handle mixed statuses including needs_auth", () => {
    const output = `Checking MCP server health…

context7: npx -y @upstash/context7-mcp@latest - ✓ Connected
gdrive: https://drivemcp.googleapis.com/mcp/v1 - ! Needs authentication
broken: docker run x - ✗ Failed
`;

    const result = parseMcpListOutput(output);

    expect(result).toEqual([
      {
        name: "context7",
        command: "npx -y @upstash/context7-mcp@latest",
        status: "connected",
      },
      {
        name: "gdrive",
        command: "https://drivemcp.googleapis.com/mcp/v1",
        status: "needs_auth",
      },
      {
        name: "broken",
        command: "docker run x",
        status: "failed",
      },
    ]);
  });

  it("should skip malformed lines", () => {
    const output = `2.0.21 (Claude Code)
Checking MCP server health...

context7: npx -y @upstash/context7-mcp@latest - ✓ Connected
invalid line without colon
: command without name
name without command:
`;

    const result = parseMcpListOutput(output);

    expect(result).toEqual([
      {
        name: "context7",
        command: "npx -y @upstash/context7-mcp@latest",
        status: "connected",
      },
    ]);
  });
});
