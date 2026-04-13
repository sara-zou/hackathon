# Error Handling Guide

Complete guide to handling errors in Subconscious applications.

## SDK Error Classes

The SDK exports typed error classes you can catch:

```typescript
import {
  SubconsciousError,    // Base class
  AuthenticationError,   // 401
  ValidationError,       // 400
  NotFoundError,        // 404
  RateLimitError,       // 429
} from "subconscious";
```

## Error Response Format

### API Error Response

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The 'engine' field is required",
    "details": {
      "field": "engine",
      "reason": "required"
    }
  }
}
```

### SDK Exception Properties

```typescript
interface SubconsciousError {
  code: string;        // Error code (e.g., "invalid_api_key")
  status: number;      // HTTP status code
  message: string;     // Human-readable message
  details?: any;       // Additional context
}
```

## Error Codes

### Authentication Errors (401)

| Code | Meaning | Fix |
|------|---------|-----|
| `invalid_api_key` | API key is invalid or missing | Check API key in environment variables |
| `authentication_failed` | Authentication failed | Verify key is active in dashboard |

```typescript
try {
  await client.run({...});
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Redirect to settings or show API key input
    console.error("Please check your API key");
  }
}
```

### Validation Errors (400)

| Code | Meaning | Fix |
|------|---------|-----|
| `invalid_request` | Request parameters invalid | Check required fields and types |
| `invalid_engine` | Engine name invalid | Use `tim`, `tim-edge`, `timini`, `tim-gpt`, or `tim-gpt-heavy` |
| `invalid_tool` | Tool definition invalid | Check tool schema |

```typescript
try {
  await client.run({...});
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Invalid request:", error.message);
    if (error.details) {
      console.error("Details:", error.details);
    }
  }
}
```

### Rate Limiting (429)

```typescript
try {
  await client.run({...});
} catch (error) {
  if (error instanceof RateLimitError) {
    const retryAfter = error.retryAfter || 60; // seconds
    console.error(`Rate limited. Retry after ${retryAfter}s`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry the request
  }
}
```

### Payment Required (402)

```typescript
try {
  await client.run({...});
} catch (error) {
  if (error instanceof SubconsciousError && error.status === 402) {
    // Redirect to billing or show upgrade prompt
    console.error("Insufficient credits. Please add credits.");
  }
}
```

### Server Errors (5xx)

```typescript
async function runWithRetry(instructions: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.run({
        engine: "tim-gpt",
        input: { instructions, tools: [] },
        options: { awaitCompletion: true },
      });
    } catch (error) {
      if (error instanceof SubconsciousError) {
        // Don't retry client errors (4xx)
        if (error.status < 500) {
          throw error;
        }
        
        // Retry server errors (5xx)
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## Run-Level Errors

Runs can fail after being accepted. Always check status:

```typescript
const run = await client.run({
  engine: "tim-gpt",
  input: { instructions: "...", tools: [] },
  options: { awaitCompletion: true },
});

switch (run.status) {
  case "succeeded":
    console.log(run.result?.answer);
    break;
    
  case "failed":
    console.error("Run failed:", run.error?.message);
    if (run.error?.code === "timeout") {
      // Offer to retry with longer timeout
    }
    break;
    
  case "timed_out":
    console.error("Run timed out");
    // Offer to retry
    break;
    
  case "canceled":
    console.log("Run was canceled");
    break;
    
  default:
    console.log("Run status:", run.status);
}
```

## Error Handling Patterns

### Pattern 1: Simple Try-Catch

```typescript
try {
  const run = await client.run({...});
  if (run.status === "succeeded") {
    return run.result?.answer;
  } else {
    throw new Error(run.error?.message || "Run failed");
  }
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle auth error
  } else if (error instanceof ValidationError) {
    // Handle validation error
  } else {
    // Handle other errors
    console.error("Unexpected error:", error);
  }
}
```

### Pattern 2: Error Handler Utility

```typescript
function handleSubconsciousError(error: unknown): string {
  if (error instanceof AuthenticationError) {
    return "Please check your API key in settings.";
  }
  
  if (error instanceof ValidationError) {
    return `Invalid request: ${error.message}`;
  }
  
  if (error instanceof RateLimitError) {
    return `Rate limited. Please try again in a moment.`;
  }
  
  if (error instanceof SubconsciousError) {
    if (error.status === 402) {
      return "Insufficient credits. Please add credits to continue.";
    }
    if (error.status >= 500) {
      return "Service temporarily unavailable. Please try again.";
    }
    return `Error: ${error.message}`;
  }
  
  return "An unexpected error occurred. Please try again.";
}

// Usage
try {
  const run = await client.run({...});
} catch (error) {
  const userMessage = handleSubconsciousError(error);
  showErrorToUser(userMessage);
}
```

### Pattern 3: Retry with Exponential Backoff

```typescript
async function runWithRetry(
  params: RunParams,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<RunResponse> {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.run(params);
    } catch (error) {
      if (error instanceof SubconsciousError) {
        // Don't retry client errors
        if (error.status < 500) {
          throw error;
        }
        
        // Last attempt
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error("Max retries exceeded");
}
```

## HTTP Status Codes

| Status | Code | Meaning | Retry? |
|--------|------|---------|--------|
| 400 | `invalid_request` | Bad request | No - fix request |
| 401 | `invalid_api_key` | Auth failed | No - check key |
| 402 | `insufficient_credits` | Payment required | No - add credits |
| 403 | `forbidden` | Permission denied | No - check permissions |
| 404 | `not_found` | Resource not found | No - check resource |
| 429 | `rate_limited` | Too many requests | Yes - after delay |
| 500 | `server_error` | Server error | Yes - with backoff |
| 502 | `bad_gateway` | Gateway error | Yes - with backoff |
| 503 | `service_unavailable` | Service down | Yes - after delay |

## Best Practices

1. **Always check run.status** - Don't access `run.result` without checking
2. **Handle specific errors** - Use typed error classes when possible
3. **Retry 5xx errors** - Use exponential backoff
4. **Don't retry 4xx errors** - Fix the request instead
5. **Show user-friendly messages** - Don't expose technical error details
6. **Log errors for debugging** - Include error.code and error.details
7. **Handle timeouts gracefully** - Offer to retry with longer timeout
8. **Monitor error rates** - Alert on spikes

## Resources

- **TypeScript Types**: See `typescript-types.md`
- **API Reference**: See `api-reference.md`
- **SDK Source**: https://github.com/subconscious-systems/subconscious-node
