import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchArchives, fetchEntries, retrievalSource } from "./aon";

// stdout carries the JSON-RPC protocol — anything else printed there corrupts
// the stream. Diagnostics go to stderr, which Claude Code shows in MCP logs.
const log = (message: string) => process.stderr.write(`[nethys] ${message}\n`);

const json = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
});

const server = new McpServer({ name: "nethys", version: "1.0.0" });

server.registerTool(
  "search_archives",
  {
    title: "Search Archives of Nethys",
    description:
      "Search the Archives of Nethys, the complete Pathfinder 2e rules database " +
      "(45,000+ entries: spells, feats, creatures, items, conditions, class " +
      "features, and rules text). Returns summaries — use fetch_entries for exact " +
      "wording. Call this for any Pathfinder 2e rules question rather than " +
      "answering from memory, since specific levels, DCs, action counts, and " +
      "prerequisites are easy to misremember. Returns current post-Remaster " +
      "content and hides superseded entries unless include_legacy is set.",
    inputSchema: {
      query: z
        .string()
        .describe(
          "Search terms. Prefer Pathfinder vocabulary over plain English: " +
            "'off-guard flanking' beats 'sneaking up on someone'."
        ),
      category: z
        .array(z.string())
        .optional()
        .describe(
          "Optional filter. Common values: spell, feat, creature, equipment, " +
            "rules, action, condition, class-feature, trait, class, ancestry, " +
            "heritage, background, hazard, deity, weapon, armor, ritual, curse."
        ),
      traits: z
        .array(z.string())
        .optional()
        .describe("Optional trait filter, e.g. ['Fire'] or ['Rogue']. All must be present. Capitalized."),
      level_min: z.number().optional().describe("Optional minimum level."),
      level_max: z.number().optional().describe("Optional maximum level."),
      include_legacy: z
        .boolean()
        .optional()
        .describe(
          "Include pre-Remaster entries that have since been replaced. Default " +
            "false. Set true only when asked about an older printing."
        ),
      limit: z.number().optional().describe("Max results, default 12, cap 40."),
    },
  },
  async (input) => {
    const source = retrievalSource();
    const hits = await searchArchives(input as any);
    log(`search "${input.query}" → ${hits.length} hits (${source.reason})`);
    return json({ source: source.reason, hits });
  }
);

server.registerTool(
  "fetch_entries",
  {
    title: "Fetch full rules text",
    description:
      "Fetch the complete rules text of specific entries by id, as returned by " +
      "search_archives (e.g. 'spell-1530'). Up to 10 at a time. Call this before " +
      "quoting exact numbers, durations, prerequisites, or stat blocks — search " +
      "results are summaries and do not carry the full wording.",
    inputSchema: {
      ids: z.array(z.string()).describe("Entry ids, e.g. ['condition-58', 'spell-1530']."),
    },
  },
  async (input) => {
    const entries = await fetchEntries(input.ids);
    log(`read ${entries.map((entry) => entry.name).join(", ") || "(nothing)"}`);
    return json(entries);
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
  log("ready");
}

main().catch((error) => {
  log(`fatal: ${error?.message ?? error}`);
  process.exit(1);
});
