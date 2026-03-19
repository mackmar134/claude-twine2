# claude-twine2

MCP server for authoring [Twine 2](https://twinery.org/) interactive fiction stories through Claude. Supports Harlowe, SugarCube, Chapbook, and Snowman story formats with full read/write for both Twine 2 HTML and Twee 3.

## Setup

```bash
npm install
npm run build
```

Add the server to your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Windows (Store)**: `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "twine": {
      "command": "node",
      "args": ["/absolute/path/to/claude-twine2/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop after saving.

## Tools

| Tool | Description |
|------|-------------|
| `create_story` | Create a new story with a given format |
| `list_stories` | List stories in the current session |
| `get_story` | Get full story data as JSON |
| `delete_story` | Remove a story from the session |
| `add_passage` | Add a passage with `[[link]]` syntax |
| `edit_passage` | Edit passage text, name, or tags |
| `read_passage` | Read a single passage |
| `list_passages` | List all passages and their connections |
| `delete_passage` | Remove a passage |
| `set_start` | Set the starting passage |
| `get_story_map` | Show passage graph with dead ends, orphans, and broken links |
| `export_html` | Save as Twine 2 HTML |
| `export_twee` | Save as Twee 3 |
| `import_story` | Load a `.html` or `.twee` file from disk |
| `import_story_from_text` | Load from raw text content |
| `convert_format` | Convert between HTML and Twee 3 |

## Development

```bash
npm run dev      # ts-node-dev with hot reload
npm run build    # compile to dist/
npm start        # run compiled server
```

## Security

This server reads and writes files at paths specified during tool calls. It runs locally over stdio and has no network exposure. As with any MCP server, the user is responsible for reviewing tool invocations in Claude Desktop before approving them.

## License

MIT
