# Subconscious Examples

Complete, copy-paste-able examples for building with Subconscious.

## Simple Chat (No Tools)

### Python

```python
from subconscious import Subconscious

client = Subconscious(api_key="your-api-key")  # Get from https://subconscious.dev/platform

run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Explain quantum computing in simple terms",
        "tools": []
    },
    options={"await_completion": True}
)

# Extract clean text answer
answer = run.result.answer
print(answer)
```

### Node.js/TypeScript

```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const run = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Explain quantum computing in simple terms",
    tools: [],
  },
  options: { awaitCompletion: true },
});

// Extract clean text answer
const answer = run.result?.answer;
console.log(answer);
```

## Chat with Message History

Converting message history to instructions format:

### Python

```python
from subconscious import Subconscious

client = Subconscious(api_key="your-api-key")

# Message history (like from a chat UI)
messages = [
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi there! How can I help?"},
    {"role": "user", "content": "Tell me about quantum computing"}
]

# Convert to instructions string
instructions = "\n\n".join([
    f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
    for m in messages
]) + "\n\nRespond to the user's latest message."

run = client.run(
    engine="tim-gpt",
    input={"instructions": instructions, "tools": []},
    options={"await_completion": True}
)

print(run.result.answer)  # Clean text response
```

### Node.js/TypeScript

```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const messages = [
  { role: "user", content: "Hello!" },
  { role: "assistant", content: "Hi there! How can I help?" },
  { role: "user", content: "Tell me about quantum computing" }
];

// Convert to instructions string
const instructions = messages
  .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
  .join("\n\n") + "\n\nRespond to the user's latest message.";

const run = await client.run({
  engine: "tim-gpt",
  input: { instructions, tools: [] },
  options: { awaitCompletion: true },
});

console.log(run.result?.answer);  // Clean text response
```

## Search Agent with Custom Tool

### Complete Example: Python

**1. Tool Server (FastAPI):**

```python
# server.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI()

class SearchRequest(BaseModel):
    query: str
    max_results: int = 10

class SearchResult(BaseModel):
    title: str
    url: str
    description: str

@app.post("/search", response_model=List[SearchResult])
async def search(req: SearchRequest):
    # Mock search - replace with real search logic
    return [
        SearchResult(
            title=f"Result {i}",
            url=f"https://example.com/{i}",
            description=f"Description for result {i} about {req.query}"
        )
        for i in range(min(req.max_results, 5))
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**2. Agent Client:**

```python
# agent.py
from subconscious import Subconscious

# Your tool server URL (use ngrok for local: ngrok http 8000)
TOOL_SERVER_URL = "https://your-ngrok-url.ngrok.io"

client = Subconscious(api_key="your-api-key")

tools = [
    {
        "type": "function",
        "name": "web_search",
        "description": "Search the web for current information. Returns title, URL, and description of results.",
        "url": f"{TOOL_SERVER_URL}/search",
        "method": "POST",
        "timeout": 10,
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query in natural language"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results (default: 10)",
                    "default": 10
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    }
]

run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Search for information about quantum computing breakthroughs in 2025",
        "tools": tools
    },
    options={"await_completion": True}
)

# Extract clean text answer
print(run.result.answer)
```

### Complete Example: Node.js/TypeScript

**1. Tool Server (Express):**

```typescript
// server.ts
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

app.post("/search", (req: Request<{}, SearchResult[], SearchRequest>, res: Response<SearchResult[]>) => {
  const { query, max_results = 10 } = req.body;
  
  // Mock search - replace with real search logic
  const results: SearchResult[] = Array.from({ length: Math.min(max_results, 5) }, (_, i) => ({
    title: `Result ${i + 1}`,
    url: `https://example.com/${i + 1}`,
    description: `Description for result ${i + 1} about ${query}`
  }));
  
  res.json(results);
});

app.listen(8000, () => {
  console.log("Tool server running on :8000");
});
```

**2. Agent Client:**

```typescript
// agent.ts
import { Subconscious } from "subconscious";

// Your tool server URL (use ngrok for local: ngrok http 8000)
const TOOL_SERVER_URL = "https://your-ngrok-url.ngrok.io";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const tools = [
  {
    type: "function" as const,
    name: "web_search",
    description: "Search the web for current information. Returns title, URL, and description of results.",
    url: `${TOOL_SERVER_URL}/search`,
    method: "POST" as const,
    timeout: 10,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query in natural language"
        },
        max_results: {
          type: "integer",
          description: "Maximum number of results (default: 10)",
          default: 10
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
];

const run = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Search for information about quantum computing breakthroughs in 2025",
    tools: tools
  },
  options: { awaitCompletion: true },
});

// Extract clean text answer
console.log(run.result?.answer);
```

## Structured Output Example

Get type-safe, structured responses using JSON Schema:

### Python with Pydantic

```python
from subconscious import Subconscious
from pydantic import BaseModel

class AnalysisResult(BaseModel):
    summary: str
    key_points: list[str]
    sentiment: str
    confidence: float

client = Subconscious(api_key="your-api-key")

run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Analyze the latest AI news and provide a structured analysis",
        "tools": [{"type": "platform", "id": "web_search"}],
        "answerFormat": AnalysisResult,  # Pass Pydantic model directly
    },
    options={"await_completion": True},
)

# Result is already a dict - no parsing needed
result = run.result.answer
print(result["summary"])
print(result["key_points"])
print(result["sentiment"])
```

### Node.js/TypeScript with Zod

```typescript
import { z } from 'zod';
import { Subconscious, zodToJsonSchema } from 'subconscious';

const AnalysisSchema = z.object({
  summary: z.string().describe('A brief summary of the findings'),
  keyPoints: z.array(z.string()).describe('Main takeaways'),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1).describe('Confidence score'),
});

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const run = await client.run({
  engine: 'tim-gpt',
  input: {
    instructions: 'Analyze the latest news about electric vehicles',
    tools: [{ type: 'platform', id: 'fast_search' }],
    answerFormat: zodToJsonSchema(AnalysisSchema, 'Analysis'),
  },
  options: { awaitCompletion: true },
});

// Result is typed according to your schema
const result = run.result?.answer as z.infer<typeof AnalysisSchema>;
console.log(result.summary);
console.log(result.keyPoints);
console.log(result.sentiment);
```

### Manual JSON Schema

```typescript
const run = await client.run({
  engine: 'tim-gpt',
  input: {
    instructions: 'Extract key information from the text',
    tools: [],
    answerFormat: {
      type: 'object',
      title: 'ExtractedInfo',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
        },
        summary: { type: 'string' },
      },
      required: ['entities', 'summary'],
    },
  },
  options: { awaitCompletion: true },
});

const result = run.result?.answer;
console.log(result.entities);
console.log(result.summary);
```

## Multi-Tool Agent

### Python

```python
from subconscious import Subconscious

TOOL_SERVER_URL = "https://your-server.com"

client = Subconscious(api_key="your-api-key")

tools = [
    {
        "type": "function",
        "name": "web_search",
        "description": "Search the web for current information",
        "url": f"{TOOL_SERVER_URL}/search",
        "method": "POST",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"]
        }
    },
    {
        "type": "function",
        "name": "save_to_database",
        "description": "Save research findings to database",
        "url": f"{TOOL_SERVER_URL}/save",
        "method": "POST",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["title", "content"]
        }
    },
    {
        "type": "function",
        "name": "send_email",
        "description": "Send email notification",
        "url": f"{TOOL_SERVER_URL}/email",
        "method": "POST",
        "parameters": {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"}
            },
            "required": ["to", "subject", "body"]
        }
    }
]

run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Research the latest AI news, save the top 3 findings to the database, and email me a summary",
        "tools": tools
    },
    options={"await_completion": True}
)

print(run.result.answer)
```

## Async Run with Polling

### Using client.get() (Manual Polling)

### Python

```python
from subconscious import Subconscious
import time

client = Subconscious(api_key="your-api-key")

# Start async run (no await_completion)
run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Generate a comprehensive market analysis report",
        "tools": tools
    }
    # No await_completion - returns immediately
)

run_id = run.run_id
print(f"Run started: {run_id}")

# Poll for completion
while True:
    status = client.get(run_id)
    if status.status == "succeeded":
        print(status.result.answer)
        break
    elif status.status == "failed":
        print(f"Run failed: {status.error}")
        break
    time.sleep(2)  # Poll every 2 seconds
```

### Node.js/TypeScript

```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

// Start async run
const run = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Generate a comprehensive market analysis report",
    tools: tools
  }
  // No awaitCompletion - returns immediately
});

const runId = run.runId;
console.log(`Run started: ${runId}`);

// Poll for completion
while (true) {
  const status = await client.get(runId);
  if (status.status === "succeeded") {
    console.log(status.result?.answer);
    break;
  } else if (status.status === "failed") {
    console.error(`Run failed: ${status.error}`);
    break;
  }
    await new Promise(resolve => setTimeout(resolve, 2000));  // Poll every 2 seconds
}
```

### Using client.wait() (Automatic Polling)

**Python:**
```python
from subconscious import Subconscious

client = Subconscious(api_key="your-api-key")

# Start async run
run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Generate a comprehensive market analysis report",
        "tools": tools
    }
    # No await_completion - returns immediately
)

# Automatically poll until complete
result = client.wait(
    run.run_id,
    options={
        "interval_ms": 2000,  # Poll every 2 seconds
        "max_attempts": 60,   # Give up after 60 attempts (2 minutes)
    }
)

print(result.result.answer)
```

**Node.js/TypeScript:**
```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

// Start async run
const run = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Generate a comprehensive market analysis report",
    tools: tools
  }
  // No awaitCompletion - returns immediately
});

// Automatically poll until complete
const result = await client.wait(run.runId, {
  intervalMs: 2000,  // Poll every 2 seconds
  maxAttempts: 60,   // Give up after 60 attempts
});

console.log(result.result?.answer);
```

## Webhooks (Async Notifications)

Get notified when runs complete without polling:

### Python

**1. Start Run with Callback URL:**
```python
from subconscious import Subconscious

client = Subconscious(api_key="your-api-key")

run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Generate a detailed report",
        "tools": []
    },
    output={
        "callbackUrl": "https://your-server.com/webhooks/subconscious"
    }
)

print(f"Run started: {run.run_id}")
# Run will POST result to your callback URL when complete
```

**2. Webhook Handler (FastAPI):**
```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/webhooks/subconscious")
async def handle_webhook(request: Request):
    payload = await request.json()
    
    run_id = payload.get("runId")
    status = payload.get("status")
    
    if status == "succeeded":
        result = payload.get("result", {})
        answer = result.get("answer", "")
        print(f"Run {run_id} completed: {answer[:100]}...")
        # Save to database, trigger next step, etc.
    elif status == "failed":
        error = payload.get("error", {})
        print(f"Run {run_id} failed: {error.get('message')}")
    
    return {"received": True}
```

### Node.js/TypeScript

**1. Start Run with Callback URL:**
```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const run = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Generate a detailed report",
    tools: []
  },
  output: {
    callbackUrl: "https://your-server.com/webhooks/subconscious"
  }
});

console.log(`Run started: ${run.runId}`);
// Run will POST result to your callback URL when complete
```

**2. Webhook Handler (Express):**
```typescript
import express from "express";

const app = express();
app.use(express.json());

app.post("/webhooks/subconscious", (req, res) => {
  const { runId, status, result, error } = req.body;
  
  if (status === "succeeded") {
    console.log(`Run ${runId} completed:`, result?.answer?.slice(0, 100));
    // Save to database, trigger next step, etc.
  } else if (status === "failed") {
    console.error(`Run ${runId} failed:`, error?.message);
  }
  
  // Always respond quickly with 2xx
  res.status(200).json({ received: true });
});

app.listen(8000, () => {
  console.log("Webhook server running on :8000");
});
```

### Webhook Payload

When a run completes, Subconscious POSTs this JSON to your callback URL:

```json
{
  "runId": "run_abc123...",
  "status": "succeeded",
  "result": {
    "answer": "The report content...",
    "reasoning": [...]
  },
  "usage": {
    "inputTokens": 1234,
    "outputTokens": 567,
    "durationMs": 45000
  },
  "error": null
}
```

### Webhook Best Practices

1. **Respond quickly** - Return 2xx within 30 seconds
2. **Be idempotent** - You may receive the same webhook twice
3. **Process async** - Do heavy work in background, respond immediately
4. **Use ngrok for local dev** - Expose local server publicly
5. **Validate origin** - Check request headers (signature verification coming soon)

## Streaming with Reasoning Display

Complete example showing how to stream and display reasoning steps (like ChatGPT's thinking process):

### Next.js API Route with Reasoning Extraction

```typescript
// app/api/chat/stream/route.ts
import { Subconscious } from "subconscious";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Extract thoughts from JSON content (same pattern as school_scheduler)
function extractThoughts(content: string): string[] {
  const thoughts: string[] = [];
  
  // Find "thought": "..." patterns
  const thoughtPattern = /"thought"\s*:\s*"([^"]+(?:\\.[^"]*)*?)"/g;
  let match;
  
  while ((match = thoughtPattern.exec(content)) !== null) {
    // Unescape the string
    const thought = match[1]
      .replace(/\\n/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    
    if (thought && thought.length > 10) {
      thoughts.push(thought);
    }
  }
  
  // Also extract titles for context
  const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
  while ((match = titlePattern.exec(content)) !== null) {
    const title = match[1].trim();
    if (title && title.length > 5 && !thoughts.includes(title)) {
      thoughts.unshift(title); // Add titles at beginning
    }
  }
  
  return thoughts;
}

export async function POST(req: NextRequest) {
  const { messages, tools = [] } = await req.json();
  
  // Convert messages to instructions
  const instructions = messages
    .map((m: { role: string; content: string }) => 
      `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
    )
    .join("\n\n") + "\n\nRespond to the user's latest message.";
  
  const client = new Subconscious({
    apiKey: process.env.SUBCONSCIOUS_API_KEY!,
  });
  
  const stream = client.stream({
    engine: "tim-gpt",
    input: { instructions, tools },
  });
  
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        let fullContent = "";
        let lastSentThoughts: string[] = [];
        
        for await (const event of stream) {
          if (event.type === "delta") {
            fullContent += event.content;
            
            // Extract and send new thoughts
            const thoughts = extractThoughts(fullContent);
            const newThoughts = thoughts.filter(
              (t) => !lastSentThoughts.includes(t)
            );
            
            // Send each new thought as separate event
            for (const thought of newThoughts) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "thought", thought })}\n\n`
                )
              );
              lastSentThoughts.push(thought);
            }
          } else if (event.type === "done") {
            // Parse final answer
            try {
              const final = JSON.parse(fullContent);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "answer", answer: final.answer })}\n\n`
                )
              );
            } catch {
              // Fallback: extract answer field using regex
              const answerMatch = fullContent.match(/"answer"\s*:\s*"([^"]+)"/);
              if (answerMatch) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "answer", answer: answerMatch[1] })}\n\n`
                  )
                );
              }
            }
            
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } else if (event.type === "error") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: event.message })}\n\n`
              )
            );
            controller.close();
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
  
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### React Component: Display Reasoning Steps

```tsx
"use client";

import { useState } from "react";

interface Thought {
  id: number;
  text: string;
  isComplete: boolean;
}

export function ChatWithReasoning() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThought, setCurrentThought] = useState<string>("");
  
  const sendMessage = async (message: string) => {
    setThoughts([]);
    setAnswer("");
    setIsStreaming(true);
    setCurrentThought("");
    
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        tools: []
      }),
    });
    
    if (!response.body) return;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let thoughtId = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "thought") {
              // Mark previous thought as complete
              setThoughts(prev => 
                prev.map(t => t.id === thoughtId - 1 ? { ...t, isComplete: true } : t)
              );
              
              // Add new thought
              const newThought = { 
                id: thoughtId++, 
                text: data.thought, 
                isComplete: false 
              };
              setThoughts(prev => [...prev, newThought]);
              setCurrentThought(data.thought);
            } else if (data.type === "answer") {
              setAnswer(data.answer);
              setIsStreaming(false);
              setCurrentThought("");
              // Mark last thought as complete
              setThoughts(prev => 
                prev.map((t, i) => i === prev.length - 1 ? { ...t, isComplete: true } : t)
              );
            } else if (data.type === "error") {
              console.error("Stream error:", data.message);
              setIsStreaming(false);
            }
          } catch (e) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
  };
  
  return (
    <div className="chat-container">
      {/* Reasoning Display */}
      {thoughts.length > 0 && (
        <div className="reasoning-container">
          <div className="reasoning-header">
            <span className="thinking-dot" />
            Agent Thinking
          </div>
          <div className="thoughts-list">
            {thoughts.map((thought) => (
              <div
                key={thought.id}
                className={`thought-item ${thought.isComplete ? "complete" : "active"}`}
              >
                <span className="thought-number">{thought.id + 1}</span>
                <span className="thought-text">
                  {thought.text}
                  {!thought.isComplete && <span className="cursor">▌</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Current Thought Indicator */}
      {isStreaming && currentThought && (
        <div className="current-thought">
          <span className="thinking-dots">
            <span></span><span></span><span></span>
          </span>
          {currentThought}
        </div>
      )}
      
      {/* Final Answer */}
      {answer && (
        <div className="answer">
          {answer}
        </div>
      )}
    </div>
  );
}
```

**See `streaming-and-reasoning.md` for complete CSS and more examples.**

## Next.js/Vercel API Route Example (Simple Chat)

Simple Next.js API route without streaming:

```typescript
// app/api/chat/route.ts (Next.js App Router)
import { Subconscious } from "subconscious";
import { NextRequest } from "next/server";

export const runtime = "edge";  // Edge runtime compatible

export async function POST(req: NextRequest) {
  const { messages, tools = [] } = await req.json();

  // Convert messages to instructions
  const instructions = messages
    .map((m: { role: string; content: string }) => 
      `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
    )
    .join("\n\n") + "\n\nRespond to the user's latest message.";

  const client = new Subconscious({
    apiKey: process.env.SUBCONSCIOUS_API_KEY!,
  });

  // Use run() for clean text responses
  const run = await client.run({
    engine: "tim-gpt",
    input: { instructions, tools },
    options: { awaitCompletion: true },
  });

  // Return clean answer
  return Response.json({
    answer: run.result?.answer,
    reasoning: run.result?.reasoning,  // Optional: for debugging
  });
}
```

**Note**: For streaming with reasoning display, see the "Streaming with Reasoning Display" section above. It shows the complete pattern for extracting thoughts from the JSON stream.

**Client-side usage (React):**

```typescript
// components/Chat.tsx
"use client";

import { useState } from "react";

export function Chat() {
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...messages, userMessage],
        tools: []
      }),
    });

    const data = await response.json();
    setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
  };

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={e => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Important Notes

1. **Always use `run.result?.answer`** - This is the clean text response
2. **`stream()` returns raw JSON** - You must parse it. See `streaming-and-reasoning.md` for complete guide
3. **Convert messages to instructions** - Subconscious uses single string, not array
4. **Environment variable**: `SUBCONSCIOUS_API_KEY` (not `OPENAI_API_KEY`)
5. **For reasoning UI**: Use `stream()` and extract thoughts. See examples above.
6. **For simple chat**: Use `run()` - it's easier and returns clean text directly

## Running Examples

### Setup

**Python:**
```bash
pip install subconscious fastapi uvicorn
```

**Node.js:**
```bash
npm install subconscious express
npm install -D @types/express typescript
```

**Next.js:**
```bash
npm install subconscious
# Add to .env.local:
# SUBCONSCIOUS_API_KEY=your-key-here
```

### Get API Key

1. Sign up at https://subconscious.dev/platform
2. Generate API key from dashboard
3. Set as environment variable: `SUBCONSCIOUS_API_KEY`

### For Local Tool Servers

Use ngrok to expose local servers:
```bash
ngrok http 8000
# Use the ngrok URL in your tool definitions
```

## Next Steps

- See `tools-guide.md` for detailed tool documentation
- See `api-reference.md` for complete API reference
- Check https://docs.subconscious.dev for latest updates
