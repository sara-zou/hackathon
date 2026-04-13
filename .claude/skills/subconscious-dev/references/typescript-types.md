# TypeScript Types Reference

Complete TypeScript type definitions for the Subconscious SDK.

## SDK Exports

```typescript
import {
  Subconscious,
  SubconsciousError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  type RunResponse,
  type RunStatus,
  type RunResult,
  type RunInput,
  type RunOptions,
  type ReasoningStep,
  type StreamEvent,
  type DeltaEvent,
  type DoneEvent,
  type ErrorEvent,
  type Tool,
  type PlatformTool,
  type FunctionTool,
  type MCPTool,
  type Usage,
} from "subconscious";
```

## Core Types

### RunResponse

```typescript
interface RunResponse {
  runId: string;
  status: RunStatus;
  result?: RunResult;
  usage?: Usage;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

type RunStatus = 
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";
```

### RunResult

```typescript
interface RunResult {
  answer: string;  // Clean text response - use this for display
  reasoning?: ReasoningStep[];  // Optional: step-by-step reasoning
}
```

### ReasoningStep

```typescript
interface ReasoningStep {
  title?: string;  // Step title/heading
  thought?: string;  // Internal reasoning text
  conclusion?: string;  // Step conclusion
  tooluse?: {
    tool_name: string;
    parameters: Record<string, unknown>;
    tool_result: unknown;
  };
  subtasks?: ReasoningStep[];  // Nested reasoning steps
}
```

### StreamEvent

```typescript
type StreamEvent = DeltaEvent | DoneEvent | ErrorEvent;

interface DeltaEvent {
  type: "delta";
  content: string;  // Raw JSON chunk - accumulates to form full JSON
}

interface DoneEvent {
  type: "done";
  runId: string;
}

interface ErrorEvent {
  type: "error";
  message: string;
}
```

### Usage

```typescript
interface Usage {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  toolCalls?: {
    [toolName: string]: number;  // Number of calls per tool
  };
}
```

## Tool Types

### Tool (Union Type)

```typescript
type Tool = PlatformTool | FunctionTool | MCPTool;
```

### PlatformTool

```typescript
interface PlatformTool {
  type: "platform";
  id: string;  // e.g., "fast_search", "web_search", "page_reader"
  options?: Record<string, any>;
}
```

### FunctionTool

```typescript
interface FunctionTool {
  type: "function";
  name: string;
  description: string;
  url: string;  // YOUR endpoint URL
  method: "POST" | "GET";
  timeout?: number;  // seconds, default 30
  parameters: {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
    additionalProperties?: boolean;
  };
  headers?: Record<string, string>;  // Optional: custom headers
  defaults?: Record<string, any>;    // Optional: hidden parameters
}
```

### MCPTool

```typescript
interface MCPTool {
  type: "mcp";
  server: string;  // MCP server URL
  name?: string;  // Specific tool (omit for all tools)
  auth?: {
    type: "bearer" | "api_key";
    token?: string;
    header?: string;  // Header name for api_key auth
  };
}
```

### PropertySchema

```typescript
interface PropertySchema {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];  // For string enums
  items?: PropertySchema;  // For arrays
  properties?: Record<string, PropertySchema>;  // For objects
  format?: "date" | "date-time" | "email" | "uuid";
  pattern?: string;  // Regex pattern for strings
}
```

## Input Types

### RunInput

```typescript
interface RunInput {
  instructions: string;  // Single string, not messages array
  tools?: Tool[];  // Optional: array of tools
  answerFormat?: JSONSchema;  // Optional: structured output schema
  reasoningFormat?: JSONSchema;  // Optional: structured reasoning schema
}
```

### RunOptions

```typescript
interface RunOptions {
  awaitCompletion?: boolean;  // Wait for completion (default: false)
  timeout?: number;  // Timeout in seconds (max 3600)
}
```

## Error Types

### SubconsciousError (Base Class)

```typescript
class SubconsciousError extends Error {
  code: string;
  status: number;
  message: string;
  details?: any;
}
```

### Specific Error Classes

```typescript
class AuthenticationError extends SubconsciousError {
  code: "invalid_api_key";
  status: 401;
}

class ValidationError extends SubconsciousError {
  code: "invalid_request";
  status: 400;
}

class NotFoundError extends SubconsciousError {
  code: "not_found";
  status: 404;
}

class RateLimitError extends SubconsciousError {
  code: "rate_limited";
  status: 429;
  retryAfter?: number;  // Seconds to wait before retry
}
```

## Client Type

### Subconscious

```typescript
class Subconscious {
  constructor(options: {
    apiKey: string;
    baseUrl?: string;  // Optional, defaults to https://api.subconscious.dev/v1
  });

  run(params: {
    engine: "tim" | "tim-edge" | "timini" | "tim-gpt" | "tim-gpt-heavy";
    input: RunInput;
    output?: {
      callbackUrl?: string;  // Webhook URL
    };
    options?: RunOptions;
  }): Promise<RunResponse>;

  stream(params: {
    engine: "tim" | "tim-edge" | "timini" | "tim-gpt" | "tim-gpt-heavy";
    input: RunInput;
    output?: {
      callbackUrl?: string;
    };
    options?: RunOptions;
  }): AsyncIterable<StreamEvent>;

  get(runId: string): Promise<RunResponse>;
  
  wait(runId: string, options?: {
    intervalMs?: number;  // Default: 2000
    maxAttempts?: number;  // Default: 60
  }): Promise<RunResponse>;
  
  cancel(runId: string): Promise<RunResponse>;
}
```

## Usage Examples

### Type-Safe Run

```typescript
import { Subconscious, type RunResponse } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const run: RunResponse = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Your prompt",
    tools: [],
  },
  options: { awaitCompletion: true },
});

// TypeScript knows these exist
if (run.status === "succeeded") {
  const answer: string = run.result!.answer;
  const reasoning = run.result!.reasoning;  // ReasoningStep[] | undefined
}
```

### Type-Safe Streaming

```typescript
import { Subconscious, type StreamEvent } from "subconscious";

const stream = client.stream({
  engine: "tim-gpt",
  input: { instructions: "...", tools: [] },
});

for await (const event: StreamEvent of stream) {
  if (event.type === "delta") {
    // TypeScript knows event.content exists
    console.log(event.content);
  } else if (event.type === "done") {
    // TypeScript knows event.runId exists
    console.log(event.runId);
  } else if (event.type === "error") {
    // TypeScript knows event.message exists
    console.error(event.message);
  }
}
```

### Type-Safe Error Handling

```typescript
import {
  Subconscious,
  SubconsciousError,
  AuthenticationError,
  RateLimitError,
} from "subconscious";

try {
  const run = await client.run({...});
} catch (error) {
  if (error instanceof AuthenticationError) {
    // TypeScript knows error.code is "invalid_api_key"
    console.error("Invalid API key");
  } else if (error instanceof RateLimitError) {
    // TypeScript knows error.retryAfter might exist
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof SubconsciousError) {
    // TypeScript knows error.code, error.status, error.message
    console.error(`Error ${error.status}: ${error.code}`);
  }
}
```

## Resources

- **SDK Source**: https://github.com/subconscious-systems/subconscious-node
- **Type Definitions**: Check `node_modules/subconscious/dist/index.d.ts`
- **API Reference**: See `api-reference.md`
