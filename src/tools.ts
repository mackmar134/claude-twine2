import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { store } from "./store";
import { parseHtml, parseTwee, storyToHtml, storyToTwee } from "./twine-parser";
import * as fs from "fs";
import * as path from "path";

// Extracts [[link]] targets from passage text
function extractLinks(text: string): string[] {
  const links: string[] = [];
  const re = /\[\[(.*?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1];
    const arrow = inner.indexOf("->");
    const pipe = inner.indexOf("|");
    if (arrow !== -1) links.push(inner.slice(arrow + 2).trim());
    else if (pipe !== -1) links.push(inner.slice(pipe + 1).trim());
    else links.push(inner.trim());
  }
  return links;
}

export function registerTools(server: McpServer): void {

  server.tool(
    "create_story",
    "Create a new Twine interactive fiction story",
    {
      name: z.string().describe("Story title"),
      format: z.enum(["Harlowe", "SugarCube", "Chapbook", "Snowman"]).optional()
        .describe("Story format (default: Harlowe)"),
    },
    async ({ name, format }) => {
      const story = store.create(name, format);
      return {
        content: [{ type: "text", text: `Created story "${story.name}" (${story.format}, IFID: ${story.ifid})` }],
      };
    }
  );

  server.tool(
    "list_stories",
    "List all stories in the current session",
    {},
    async () => {
      const names = store.list();
      if (names.length === 0) {
        return { content: [{ type: "text", text: "No stories in session. Use create_story to start one." }] };
      }
      const details = names.map((n) => {
        const s = store.get(n)!;
        return `- "${s.name}" (${s.format}, ${s.passages.length} passages, start: ${s.startPassage || "none"})`;
      });
      return { content: [{ type: "text", text: details.join("\n") }] };
    }
  );

  server.tool(
    "get_story",
    "Get full details of a story including all passages",
    {
      storyName: z.string().describe("Name of the story"),
    },
    async ({ storyName }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(story, null, 2) }] };
    }
  );

  server.tool(
    "delete_story",
    "Delete a story from the session",
    {
      storyName: z.string().describe("Name of the story to delete"),
    },
    async ({ storyName }) => {
      const deleted = store.delete(storyName);
      return {
        content: [{ type: "text", text: deleted ? `Deleted "${storyName}".` : `Story "${storyName}" not found.` }],
        isError: !deleted,
      };
    }
  );

  server.tool(
    "add_passage",
    "Add a new passage to a story. Use [[Target]] syntax for links in the text.",
    {
      storyName: z.string().describe("Name of the story"),
      passageName: z.string().describe("Passage title/name"),
      text: z.string().describe("Passage content (use [[Link Text->Target]] or [[Target]] for choices)"),
      tags: z.array(z.string()).optional().describe("Tags for the passage"),
    },
    async ({ storyName, passageName, text, tags }) => {
      try {
        const links = extractLinks(text);
        const passage = store.addPassage(storyName, { name: passageName, text, tags, links });
        const linkInfo = links.length > 0 ? ` Links to: ${links.join(", ")}` : " No outgoing links.";
        return {
          content: [{ type: "text", text: `Added passage "${passage.name}" (pid: ${passage.pid}).${linkInfo}` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: err.message }], isError: true };
      }
    }
  );

  server.tool(
    "edit_passage",
    "Edit an existing passage's text, name, or tags",
    {
      storyName: z.string().describe("Name of the story"),
      passageName: z.string().describe("Current passage name"),
      newText: z.string().optional().describe("New passage text (replaces entire content)"),
      newName: z.string().optional().describe("Rename the passage"),
      tags: z.array(z.string()).optional().describe("Replace tags"),
    },
    async ({ storyName, passageName, newText, newName, tags }) => {
      try {
        const updates: any = {};
        if (newText !== undefined) {
          updates.text = newText;
          updates.links = extractLinks(newText);
        }
        if (newName !== undefined) updates.name = newName;
        if (tags !== undefined) updates.tags = tags;

        const updated = store.updatePassage(storyName, passageName, updates);
        return {
          content: [{ type: "text", text: `Updated passage "${updated.name}".` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: err.message }], isError: true };
      }
    }
  );

  server.tool(
    "read_passage",
    "Read a specific passage's content",
    {
      storyName: z.string().describe("Name of the story"),
      passageName: z.string().describe("Passage name to read"),
    },
    async ({ storyName, passageName }) => {
      const passage = store.getPassage(storyName, passageName);
      if (!passage) return { content: [{ type: "text", text: `Passage "${passageName}" not found in "${storyName}".` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(passage, null, 2) }] };
    }
  );

  server.tool(
    "list_passages",
    "List all passages in a story with their connections",
    {
      storyName: z.string().describe("Name of the story"),
    },
    async ({ storyName }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };
      if (story.passages.length === 0) {
        return { content: [{ type: "text", text: `"${storyName}" has no passages yet.` }] };
      }
      const lines = story.passages.map((p) => {
        const start = p.name === story.startPassage ? " [START]" : "";
        const links = p.links?.length ? ` → ${p.links.join(", ")}` : " (dead end)";
        const tags = p.tags?.length ? ` [${p.tags.join(", ")}]` : "";
        return `- ${p.name}${start}${tags}${links}`;
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "delete_passage",
    "Remove a passage from a story",
    {
      storyName: z.string().describe("Name of the story"),
      passageName: z.string().describe("Passage name to delete"),
    },
    async ({ storyName, passageName }) => {
      const deleted = store.deletePassage(storyName, passageName);
      return {
        content: [{ type: "text", text: deleted ? `Deleted passage "${passageName}".` : `Passage not found.` }],
        isError: !deleted,
      };
    }
  );

  server.tool(
    "set_start",
    "Set which passage is the starting passage of the story",
    {
      storyName: z.string().describe("Name of the story"),
      passageName: z.string().describe("Passage to set as the start"),
    },
    async ({ storyName, passageName }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };
      const passage = story.passages.find((p) => p.name === passageName);
      if (!passage) return { content: [{ type: "text", text: `Passage "${passageName}" not found.` }], isError: true };
      story.startPassage = passageName;
      return { content: [{ type: "text", text: `Start passage set to "${passageName}".` }] };
    }
  );

  server.tool(
    "get_story_map",
    "Get a text-based map of the story's passage connections",
    {
      storyName: z.string().describe("Name of the story"),
    },
    async ({ storyName }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };

      const allNames = new Set(story.passages.map((p) => p.name));
      const lines: string[] = [`Story Map: "${story.name}" (${story.passages.length} passages)\n`];

      const linkedTo = new Set<string>();
      for (const p of story.passages) {
        p.links?.forEach((l) => linkedTo.add(l));
      }

      const orphans = story.passages.filter((p) => !linkedTo.has(p.name) && p.name !== story.startPassage);
      const deadEnds = story.passages.filter((p) => !p.links || p.links.length === 0);
      const brokenLinks: string[] = [];

      for (const p of story.passages) {
        const start = p.name === story.startPassage ? " ★" : "";
        const linkStr = p.links?.length
          ? p.links.map((l) => {
              if (!allNames.has(l)) { brokenLinks.push(`"${p.name}" → "${l}"`); return `${l} ✗`; }
              return l;
            }).join(", ")
          : "(dead end)";
        lines.push(`${p.name}${start} → ${linkStr}`);
      }

      if (orphans.length) lines.push(`\nOrphan passages (unreachable): ${orphans.map((p) => p.name).join(", ")}`);
      if (deadEnds.length) lines.push(`Dead ends: ${deadEnds.map((p) => p.name).join(", ")}`);
      if (brokenLinks.length) lines.push(`Broken links: ${brokenLinks.join("; ")}`);

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "export_html",
    "Export a story as Twine 2 HTML file",
    {
      storyName: z.string().describe("Name of the story"),
      filePath: z.string().describe("Absolute file path to save the HTML file"),
    },
    async ({ storyName, filePath: outPath }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };

      const html = storyToHtml(story);
      const resolved = path.resolve(outPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, html, "utf-8");
      return { content: [{ type: "text", text: `Exported "${storyName}" to ${resolved}` }] };
    }
  );

  server.tool(
    "export_twee",
    "Export a story as Twee 3 text file",
    {
      storyName: z.string().describe("Name of the story"),
      filePath: z.string().describe("Absolute file path to save the Twee file"),
    },
    async ({ storyName, filePath: outPath }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };

      const twee = storyToTwee(story);
      const resolved = path.resolve(outPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, twee, "utf-8");
      return { content: [{ type: "text", text: `Exported "${storyName}" to ${resolved}` }] };
    }
  );

  server.tool(
    "import_story",
    "Import a Twine story from an HTML or Twee file on disk",
    {
      filePath: z.string().describe("Absolute path to a .html or .twee/.tw file"),
    },
    async ({ filePath: inPath }) => {
      const resolved = path.resolve(inPath);
      if (!fs.existsSync(resolved)) {
        return { content: [{ type: "text", text: `File not found: ${resolved}` }], isError: true };
      }
      const content = fs.readFileSync(resolved, "utf-8");
      const ext = path.extname(resolved).toLowerCase();
      const isHtml = ext === ".html" || ext === ".htm";

      try {
        const story = isHtml ? parseHtml(content) : parseTwee(content);
        store.set(story.name, story);
        return {
          content: [{ type: "text", text: `Imported "${story.name}" (${story.passages.length} passages, format: ${story.format || "unknown"})` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Parse error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "import_story_from_text",
    "Import a Twine story from raw HTML or Twee text content",
    {
      content: z.string().describe("Story content as HTML or Twee 3 text"),
      isHtml: z.boolean().optional().describe("True if content is Twine HTML, false/omit for Twee 3"),
    },
    async ({ content, isHtml }) => {
      try {
        const story = isHtml ? parseHtml(content) : parseTwee(content);
        store.set(story.name, story);
        return {
          content: [{ type: "text", text: `Imported "${story.name}" (${story.passages.length} passages)` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Parse error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "convert_format",
    "Convert a story between Twine HTML and Twee 3 (returns the converted text)",
    {
      storyName: z.string().describe("Name of the story to convert"),
      toFormat: z.enum(["html", "twee"]).describe("Target format"),
    },
    async ({ storyName, toFormat }) => {
      const story = store.get(storyName);
      if (!story) return { content: [{ type: "text", text: `Story "${storyName}" not found.` }], isError: true };

      const output = toFormat === "html" ? storyToHtml(story) : storyToTwee(story);
      return { content: [{ type: "text", text: output }] };
    }
  );
}
