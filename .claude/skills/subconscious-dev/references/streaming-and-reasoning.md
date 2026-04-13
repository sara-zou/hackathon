# Streaming and Reasoning Display

Complete guide to streaming responses and displaying reasoning steps in real-time.

## Understanding stream() Output

**Critical**: `stream()` returns raw JSON being built incrementally, not clean text.

### What the Stream Looks Like

The stream builds a JSON structure character by character:

```
delta: {"rea
delta: soning": [{"th
delta: ought": "I need to
delta:  analyze the user's question
delta: ",
delta: "title": "Step 1
delta: "}],
delta: "answer": "Here's the answer
delta: "}
done: {runId: "run_xxx"}
```

The final structure is:
```json
{
  "reasoning": [
    {
      "thought": "I need to analyze the user's question",
      "title": "Step 1"
    }
  ],
  "answer": "Here's the answer"
}
```

### Why This Matters

- `event.content` in delta events = raw JSON characters/chunks
- You must parse it to extract reasoning steps
- The answer is embedded in the JSON, not separate
- For simple chat, use `run()` instead (returns clean `result.answer`)

## Extracting Reasoning from Stream

### Pattern: Extract Thoughts as They Build

```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

// Helper to extract thoughts from JSON string
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

// Stream and extract reasoning
const stream = client.stream({
  engine: "tim-gpt",
  input: {
    instructions: "Research quantum computing breakthroughs",
    tools: []
  }
});

let fullContent = "";
let lastSentThoughts: string[] = [];

for await (const event of stream) {
  if (event.type === "delta") {
    fullContent += event.content;
    
    // Extract thoughts from accumulated content
    const thoughts = extractThoughts(fullContent);
    
    // Find new thoughts that haven't been sent yet
    const newThoughts = thoughts.filter(
      (t) => !lastSentThoughts.includes(t)
    );
    
    // Emit new thoughts
    for (const thought of newThoughts) {
      console.log("Thinking:", thought);
      // Send to UI via SSE, WebSocket, or state update
      lastSentThoughts.push(thought);
    }
  } else if (event.type === "done") {
    // Parse final answer
    try {
      const final = JSON.parse(fullContent);
      console.log("Answer:", final.answer);
    } catch (e) {
      // If parsing fails, try to extract answer field
      const answerMatch = fullContent.match(/"answer"\s*:\s*"([^"]+)"/);
      if (answerMatch) {
        console.log("Answer:", answerMatch[1]);
      }
    }
  }
}
```

## Next.js API Route: Streaming with Reasoning

Complete example for Next.js App Router:

```typescript
// app/api/chat/stream/route.ts
import { Subconscious } from "subconscious";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Extract thoughts from JSON content
function extractThoughts(content: string): string[] {
  const thoughts: string[] = [];
  const thoughtPattern = /"thought"\s*:\s*"([^"]+(?:\\.[^"]*)*?)"/g;
  let match;
  
  while ((match = thoughtPattern.exec(content)) !== null) {
    const thought = match[1]
      .replace(/\\n/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    
    if (thought && thought.length > 10) {
      thoughts.push(thought);
    }
  }
  
  const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
  while ((match = titlePattern.exec(content)) !== null) {
    const title = match[1].trim();
    if (title && title.length > 5 && !thoughts.includes(title)) {
      thoughts.unshift(title);
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
              // Fallback: extract answer field
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

## React Component: Display Reasoning

Complete React component for displaying reasoning steps:

```tsx
"use client";

import { useState, useEffect } from "react";

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
          const data = JSON.parse(line.slice(6));
          
          if (data.type === "thought") {
            // Mark previous thought as complete
            setThoughts(prev => 
              prev.map(t => t.id === thoughtId - 1 ? { ...t, isComplete: true } : t)
            );
            
            // Add new thought
            const newThought = { id: thoughtId++, text: data.thought, isComplete: false };
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

## CSS for Reasoning UI

```css
.reasoning-container {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #666;
}

.thinking-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4CAF50;
  animation: pulse 1.5s ease-in-out infinite;
}

.thoughts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thought-item {
  display: flex;
  gap: 12px;
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.thought-item.active {
  background: #e8f5e9;
}

.thought-item.complete {
  background: #f1f8e9;
  opacity: 0.8;
}

.thought-number {
  font-weight: 600;
  color: #4CAF50;
  min-width: 24px;
}

.thought-text {
  flex: 1;
  color: #333;
}

.cursor {
  animation: blink 1s infinite;
  color: #4CAF50;
}

.current-thought {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #e3f2fd;
  border-radius: 4px;
  margin: 8px 0;
  font-style: italic;
  color: #1976d2;
}

.thinking-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1976d2;
  animation: bounce 1.4s infinite;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
```

## When to Use stream() vs run()

| Use Case | Method | Why |
|----------|--------|-----|
| **Show thinking in real-time** | `stream()` | Users see reasoning as it happens (like ChatGPT) |
| **Simple chat, fast response** | `run()` | Easier, returns clean `result.answer` directly |
| **Background processing** | `run()` without `awaitCompletion` | Poll for status, no UI needed |
| **Debugging agent behavior** | `stream()` | See full reasoning structure |
| **Production chat app** | `run()` | Simpler, more reliable, better error handling |

## Alternative: Use run() and Show Reasoning After

If you don't need real-time reasoning display:

```typescript
const run = await client.run({
  engine: "tim-gpt",
  input: { instructions, tools: [] },
  options: { awaitCompletion: true }
});

// Show reasoning after the fact (collapsed by default)
const reasoning = run.result?.reasoning;
const answer = run.result?.answer;

// UI: Collapsible reasoning section
<div>
  {reasoning && reasoning.length > 0 && (
    <details>
      <summary>Show thinking ({reasoning.length} steps)</summary>
      {reasoning.map((step, i) => (
        <div key={i}>
          {step.title && <strong>{step.title}</strong>}
          {step.thought && <p>{step.thought}</p>}
        </div>
      ))}
    </details>
  )}
  <div className="answer">{answer}</div>
</div>
```

## Best Practices

1. **Track sent thoughts** - Use an array to avoid duplicates
2. **Accumulate content** - Build full JSON string as you stream
3. **Handle incomplete JSON** - Use try/catch when parsing
4. **Show loading state** - Display indicator while streaming
5. **Mark thoughts complete** - Update UI when new thoughts arrive
6. **Extract answer at end** - Parse final JSON for the answer field
7. **Error handling** - Catch parse errors gracefully

## Common Pitfalls

❌ **Don't display raw JSON** - Always parse and extract thoughts/answer
❌ **Don't parse on every delta** - Accumulate content first
❌ **Don't forget to unescape** - JSON strings have escaped characters
❌ **Don't use stream() for simple chat** - Use `run()` for easier UX

## Resources

- See `examples.md` for complete Next.js example
- See `api-reference.md` for stream event types
- See main `SKILL.md` for when to use each method
