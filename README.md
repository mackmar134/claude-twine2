# claude-twine-bridge

MCP server for authoring [Twine 2](https://twinery.org/) interactive fiction stories through Claude. Supports Harlowe, SugarCube, Chapbook, and Snowman story formats with full read/write for both Twine 2 HTML and Twee 3.

## Install

```bash
npm install -g claude-twine-bridge
```

Or run directly with npx (no install needed):

```bash
npx claude-twine-bridge
```

## Claude Desktop Setup

Add the server to your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Windows (Store)**: `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude\claude_desktop_config.json`

**Using npx (recommended — always up to date):**

```json
{
  "mcpServers": {
    "twine": {
      "command": "npx",
      "args": ["-y", "claude-twine-bridge"]
    }
  }
}
```

**Using a global install:**

```json
{
  "mcpServers": {
    "twine": {
      "command": "claude-twine-bridge"
    }
  }
}
```

**Using a local clone:**

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

## Auto-Save

Stories are automatically persisted to disk on every change (create, edit, delete passage, etc.). On startup, any previously saved stories are reloaded. This means stories survive across Claude Desktop sessions without needing to explicitly export.

**Default save location**: `stories/` directory next to the installed package

Override with the `TWINE_SAVE_DIR` environment variable:

```json
{
  "mcpServers": {
    "twine": {
      "command": "node",
      "args": ["/absolute/path/to/claude-twine2/dist/index.js"],
      "env": {
        "TWINE_SAVE_DIR": "/path/to/your/stories"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `create_story` | Create a new story with a given format |
| `list_stories` | List all stories (persisted across sessions) |
| `get_story` | Get full story data as JSON |
| `delete_story` | Remove a story from the session |
| `add_passage` | Add a passage with `[[link]]` syntax |
| `edit_passage` | Edit passage text, name, or tags |
| `read_passage` | Read a single passage |
| `list_passages` | List all passages and their connections |
| `delete_passage` | Remove a passage |
| `set_start` | Set the starting passage |
| `get_story_map` | Show passage graph with dead ends, orphans, and broken links |
| `validate_story` | Check for broken links, empty passages, orphans, reachability |
| `search_passages` | Search by text, name, tags, or link targets across stories |
| `story_statistics` | Word counts, branching factor, depth, tag usage |
| `rename_story` | Rename a story (updates save file on disk) |
| `merge_stories` | Combine passages from one story into another |
| `add_passages_batch` | Add multiple passages in one call |
| `clone_passage` | Duplicate a passage, optionally to another story |
| `move_passage` | Move a passage between stories |
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
