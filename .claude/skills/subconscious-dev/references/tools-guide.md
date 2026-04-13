# Subconscious Tools Guide

Complete guide to building and using tools with Subconscious.

## How Subconscious Tools Work

**Key difference from OpenAI-style client loops**: You declare **platform** tools (Subconscious-hosted), **function** tools (your HTTP endpoints), and/or **MCP** tools (hosted Model Context Protocol servers). Subconscious resolves them server-side and runs multi-hop tool use internally—you are not responsible for iterating tool calls in your app for these types.

### The Flow (function tools)

1. You define tools with `url` fields pointing to your endpoints (or pass MCP / platform entries)
2. The agent decides when to use tools based on the task
3. Subconscious invokes tools (HTTP to your server, or MCP proxy, or internal platform endpoints)
4. Tool results return as JSON and feed back into the run
5. Subconscious injects results into context and continues reasoning
6. The agent can chain multiple tool calls automatically (multi-hop reasoning)

## Tool Definition Schema

### Complete Schema

```typescript
type FunctionTool = {
  type: "function";
  name: string;                    // Tool name (used by agent)
  description: string;             // Critical: affects when agent uses tool
  url: string;                     // YOUR endpoint URL (required)
  method: "POST" | "GET";          // HTTP method
  timeout?: number;                // Timeout in seconds (default: 30)
  parameters: {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
    additionalProperties?: boolean; // Usually false
  };
  headers?: Record<string, string>; // Optional: custom headers
  defaults?: Record<string, any>;   // Optional: hidden parameters
};
```

### Property Schema

```typescript
type PropertySchema = {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;             // Important: helps agent understand usage
  enum?: string[];                 // For string enums
  items?: PropertySchema;           // For arrays
  properties?: Record<string, PropertySchema>; // For objects
  format?: "date" | "date-time" | "email" | "uuid";
  pattern?: string;                // Regex pattern for strings
};
```

## Simple Search Tools (Platform Tools)

Built-in tools hosted by Subconscious. No setup required. Example: `{ type: "platform", id: "fast_search" }`.

| Tool Name | API Name | Description |
|-----------|----------|-------------|
| Fast Search | `fast_search` | Extremely fast search for simple factual lookups |
| Web Search | `web_search` | Comprehensive web search for detailed research |
| Fresh Search | `fresh_search` | Search the web for content from the last 7 days |
| Page Reader | `page_reader` | Extract content from a specific webpage URL |
| Find Similar | `find_similar` | Find similar links to a given URL |
| People Search | `people_search` | Search for people, profiles, and bios |
| Company Search | `company_search` | Search for companies, funding info, and business details |
| News Search | `news_search` | Search for news articles and press coverage |
| Tweet Search | `tweet_search` | Search for tweets and Twitter/X discussions |
| Research Paper Search | `research_paper_search` | Search for academic research papers and studies |
| Google Search | `google_search` | Search the web using Google |

**Usage:**
```python
tools = [
    {"type": "platform", "id": "fast_search"},
    {"type": "platform", "id": "web_search"},
    {"type": "platform", "id": "page_reader"},
]
```

```typescript
tools: [
  { type: "platform", id: "fast_search" },
  { type: "platform", id: "web_search" },
  { type: "platform", id: "page_reader" },
]
```

## MCP tools (Model Context Protocol)

Connect a **hosted MCP server** over HTTP. Subconscious calls `tools/list` on your server, converts each tool into an internal function tool with a proxy URL, and executes tool calls through the MCP invoke path. **STDIO-only local MCP servers are not supported** from the API—you need a reachable HTTP MCP endpoint (tunnel with ngrok/Cloudflare in dev).

### Shape

```json
{
  "type": "mcp",
  "url": "https://your-server.example/mcp",
  "allowedTools": ["tool_a", "tool_b"],
  "auth": { "type": "bearer", "token": "..." }
}
```

- **`url`**: MCP server HTTP entrypoint (required).
- **`allowedTools`**: Optional list of tool names to expose (case-insensitive). **Omit** or include **`"*"`** to allow all discovered tools. **`[]`** explicitly exposes **no** tools (useful to disable without removing the entry).
- **`auth`**: Optional. `{ "type": "bearer", "token": "..." }` sends `Authorization: Bearer …`, or `{ "type": "api_key", "token": "…", "header": "X-Api-Key" }` for custom header auth. Sensitive values are encrypted at rest for org-owned tool configs.

### Combining with other tools

You can mix **platform**, **function**, and **mcp** entries in the same `tools` array. If two MCP servers expose the same tool name, the API may prefix names (e.g. `hostname__toolname`) to avoid collisions.

### Platform UI

Create and manage MCP tools (discovery, auth, allowed tool picker) from **subconscious.dev → Platform → Tools** in addition to passing them in run JSON.

## Function Tools

Call your own HTTP endpoints. You host the tool; Subconscious calls it during agent execution.

**Example Function Tool:**

```python
tools = [
    {
        "type": "function",
        "name": "get_weather",
        "description": "Get current weather for a city",
        "url": "https://your-server.com/weather",
        "method": "POST",
        "timeout": 10,
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "City name"
                },
                "units": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature units"
                },
            },
            "required": ["city"],
            "additionalProperties": False
        },
        # Optional: Custom headers for authentication
        "headers": {
            "x-api-key": "your-secret-key"
        },
        # Optional: Hidden defaults (not shown to model)
        "defaults": {
            "sessionId": "user-session-abc123"
        }
    }
]
```

## Building Tool Servers

### FastAPI (Python)

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

class SearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 10

class SearchResult(BaseModel):
    title: str
    url: str
    description: str

@app.post("/search", response_model=List[SearchResult])
async def search(req: SearchRequest):
    """
    Tool endpoint for web search.
    Subconscious will POST here with {"query": "...", "max_results": 10}
    """
    try:
        # Your search logic here
        results = perform_search(req.query, req.max_results)
        return [
            SearchResult(
                title=r["title"],
                url=r["url"],
                description=r["description"]
            )
            for r in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run with: uvicorn server:app --host 0.0.0.0 --port 8000
```

### Express.js (Node.js/TypeScript)

```typescript
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

interface SearchRequest {
  query: string;
  max_results?: number;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

app.post("/search", async (req: Request<{}, SearchResult[], SearchRequest>, res: Response<SearchResult[]>) => {
  /**
   * Tool endpoint for web search.
   * Subconscious will POST here with {query: "...", max_results: 10}
   */
  try {
    const { query, max_results = 10 } = req.body;
    
    // Your search logic here
    const results = await performSearch(query, max_results);
    
    res.json(results.map(r => ({
      title: r.title,
      url: r.url,
      description: r.description
    })));
  } catch (error) {
    res.status(500).json({ error: String(error) } as any);
  }
});

app.listen(8000, () => {
  console.log("Tool server running on :8000");
});
```

## Tool Request Format

When Subconscious calls your tool, it sends:

**POST Request:**
```json
{
  "query": "quantum computing",
  "max_results": 10
}
```

**Headers:**
- `Content-Type: application/json`
- Any custom headers you defined in `headers` field

## Tool Response Format

Your endpoint must return JSON:

**Success Response:**
```json
[
  {
    "title": "Result Title",
    "url": "https://example.com/article",
    "description": "Article description..."
  }
]
```

**Error Response:**
```json
{
  "error": "Error message here"
}
```

Subconscious will handle errors and retry if appropriate.

## Multiple Tools

Define multiple tools in one request. The agent will use them as needed:

```python
tools = [
    {
        "type": "function",
        "name": "web_search",
        "description": "Search the web",
        "url": "https://your-server.com/search",
        "method": "POST",
        "parameters": {...}
    },
    {
        "type": "function",
        "name": "save_to_database",
        "description": "Save results to database",
        "url": "https://your-server.com/save",
        "method": "POST",
        "parameters": {...}
    },
    {
        "type": "function",
        "name": "send_email",
        "description": "Send email notification",
        "url": "https://your-server.com/email",
        "method": "POST",
        "parameters": {...}
    }
]
```

The agent can chain these tools automatically. For example:
1. Use `web_search` to find information
2. Use `save_to_database` to store results
3. Use `send_email` to notify completion

## Tool Descriptions Matter

The `description` field is critical. It affects:
- When the agent decides to use the tool
- How the agent interprets tool results
- What parameters the agent generates

**Good description:**
```python
"description": "Search the web for current information. Returns title, URL, and description of up to 10 results. Use when you need to find recent information about a topic."
```

**Bad description:**
```python
"description": "Search tool"  # Too vague
```

## Timeouts

Set appropriate timeouts:
- **Quick operations** (search, calculation): 5-10 seconds
- **API calls**: 10-30 seconds
- **Database queries**: 30-60 seconds
- **Long operations**: Consider async patterns instead

## Local Development

For local development, expose your server publicly:

**ngrok:**
```bash
ngrok http 8000
# Use the ngrok URL in your tool definition
```

**Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:8000
```

## Best Practices

1. **Idempotent endpoints** - Tool may be called multiple times
2. **Fast responses** - Keep under timeout, ideally <5 seconds
3. **Clear error messages** - Help debugging
4. **Validate inputs** - Use Pydantic/TypeScript types
5. **Log tool calls** - For debugging and monitoring
6. **Handle rate limits** - If calling external APIs
7. **Return structured data** - JSON objects/arrays, not strings
8. **Descriptive tool names** - Use clear, action-oriented names

## Multi-Hop Reasoning

Subconscious automatically chains tool calls. The agent can:
1. Call tool A
2. Use results to decide to call tool B
3. Combine results from A and B
4. Call tool C with combined context
5. Return final answer

You don't need to manage this loop—it's handled internally by TIMRUN.

## Resources

- **Tool Examples**: See `examples.md`
- **API Reference**: See `api-reference.md`
- **Subconscious Docs**: https://docs.subconscious.dev/core-concepts/tools
