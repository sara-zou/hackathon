# Subconscious API Reference

Complete API documentation for the Subconscious platform.

## Base URL

```
https://api.subconscious.dev/v1
```

## Authentication

All endpoints require Bearer token authentication:

```bash
Authorization: Bearer YOUR_API_KEY
```

Get your API key from: https://subconscious.dev/platform

## Engines (Models)

| Engine | API Name | Type | Description |
|--------|----------|------|-------------|
| TIM | `tim` | Unified | Flagship unified agent engine for a wide range of tasks |
| TIM-Edge | `tim-edge` | Unified | Highly efficient, tuned for performance with search tools |
| TIMINI | `timini` | Compound | Complex reasoning for long-context and tool use (Gemini-3 Flash) |
| TIM-GPT | `tim-gpt` | Compound | Complex reasoning with OpenAI GPT-4.1 backend |
| TIM-GPT-Heavy | `tim-gpt-heavy` | Compound | Maximum capability with OpenAI GPT-5.2 backend |

## Using the Native SDK (Recommended)

**Use the Subconscious SDK** - this is the primary and recommended approach:

### Python SDK

```python
from subconscious import Subconscious

client = Subconscious(api_key="your-api-key")

run = client.run(
    engine="tim-gpt",
    input={
        "instructions": "Your prompt here",
        "tools": []  # Optional
    },
    options={"await_completion": True}
)

# Response structure
answer = run.result.answer  # Clean text response
reasoning = run.result.reasoning  # Optional: step-by-step reasoning
```

### Node.js/TypeScript SDK

```typescript
import { Subconscious } from "subconscious";

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY!,
});

const run = await client.run({
  engine: "tim-gpt",
  input: {
    instructions: "Your prompt here",
    tools: [],  // Optional
  },
  options: { awaitCompletion: true },
});

// Response structure
const answer = run.result?.answer;  // Clean text response
const reasoning = run.result?.reasoning;  // Optional: step-by-step reasoning
```

## Response Structure

**Critical**: The Subconscious SDK returns a different structure than OpenAI:

```typescript
interface RunResponse {
  runId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "timed_out";
  result?: {
    answer: string;  // ← Clean text response - use this for display
    reasoning?: Array<{  // Optional: internal reasoning steps
      title?: string;
      thought?: string;
      conclusion?: string;
      tooluse?: {
        tool_name: string;
        parameters: any;
        tool_result: any;
      };
      subtasks?: Array<...>;
    }>;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    toolCalls?: {
      [toolName: string]: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}
```

**For chat UIs**: Always use `run.result?.answer` - this is the clean text response ready for display.

## Direct API Endpoints

### POST /runs

Create a run (async by default):

```bash
curl -X POST https://api.subconscious.dev/v1/runs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "engine": "tim-gpt",
    "input": {
      "instructions": "Your task here",
      "tools": []
    }
  }'
```

**Response (202 Accepted):**
```json
{
  "runId": "run_abc123...",
  "status": "queued"
}
```

### GET /runs/{runId}

Poll for run status:

```bash
curl https://api.subconscious.dev/v1/runs/run_abc123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response (200 OK):**
```json
{
  "runId": "run_abc123...",
  "status": "succeeded",
  "result": {
    "answer": "The clean text response here...",
    "reasoning": [
      {
        "title": "Step 1",
        "thought": "I need to...",
        "conclusion": "Completed step 1"
      }
    ]
  },
  "usage": {
    "inputTokens": 1234,
    "outputTokens": 567,
    "durationMs": 45000,
    "toolCalls": {
      "web_search": 3
    }
  }
}
```

**Run Statuses:**
- `queued` - Waiting to be processed
- `running` - Actively executing
- `succeeded` - Completed successfully
- `failed` - Encountered an error
- `canceled` - Canceled by user
- `timed_out` - Exceeded timeout

### POST /runs/{runId}/cancel

Cancel a running run:

```bash
curl -X POST https://api.subconscious.dev/v1/runs/run_abc123/cancel \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response (200 OK):**
```json
{
  "runId": "run_abc123...",
  "status": "canceled"
}
```

### POST /runs/stream

Stream a run (Server-Sent Events):

```bash
curl -X POST https://api.subconscious.dev/v1/runs/stream \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "engine": "tim-gpt",
    "input": {
      "instructions": "Your prompt",
      "tools": []
    }
  }'
```

**SSE Format:**
```
data: {"type": "delta", "content": "chunk of text"}

data: {"type": "done", "runId": "run_abc123"}

data: [DONE]
```

**Warning**: Streaming returns raw JSON chunks. For chat UIs, use `run()` and extract `result.answer` instead.

## Webhooks

### POST /webhooks/subscriptions

Create a webhook subscription:

```bash
curl -X POST https://api.subconscious.dev/v1/webhooks/subscriptions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://your-app.com/webhooks",
    "eventTypes": ["job.succeeded", "job.failed"]
  }'
```

### Webhook Payload

When a run completes, you'll receive:

```json
{
  "runId": "run_abc123...",
  "status": "succeeded",
  "result": {
    "answer": "The clean text response",
    "reasoning": []
  },
  "tokens": {
    "inputTokens": 1234,
    "outputTokens": 567
  },
  "createdAt": "2026-01-16T20:54:09.090Z",
  "completedAt": "2026-01-16T20:54:11.779Z"
}
```

**Extract the answer**: `payload.result.answer` (not `payload.result.choices[0].message.content`)

## HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| `200` | Success | Process response |
| `202` | Accepted | Async job queued |
| `400` | Bad Request | Fix request parameters |
| `401` | Unauthorized | Check API key |
| `402` | Payment Required | Add credits |
| `403` | Forbidden | Check permissions |
| `404` | Not Found | Verify resource exists |
| `429` | Rate Limited | Retry after rate limit |
| `500` | Server Error | Retry with backoff |
| `502` | Bad Gateway | Retry |
| `503` | Service Unavailable | Retry later |

## Error Response Format

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The 'engine' field is required"
  }
}
```

## Rate Limits

Check response headers for rate limit information:
- `X-RateLimit-Limit`: Maximum requests per period
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: When limit resets

## Tool Definition Schema

See `tools-guide.md` for complete tool definition documentation.

## Important Notes

1. **No `/chat/completions` endpoint** - Use the native SDK or `/runs` endpoint
2. **Response format is different** - Use `result.answer`, not `choices[0].message.content`
3. **Instructions format** - Single string, not messages array
4. **Streaming returns raw JSON** - Use `run()` for clean text answers

## Resources

- **Full Documentation**: https://docs.subconscious.dev
- **API Reference**: https://docs.subconscious.dev/api-reference/introduction
- **Platform Dashboard**: https://subconscious.dev/platform
