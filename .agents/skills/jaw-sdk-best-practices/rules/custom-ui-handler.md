## Custom UI Handler

Building a custom `UIHandler` for app-specific mode. When using `Mode.AppSpecific`, you MUST provide a `UIHandler` implementation that handles all wallet interaction prompts within your application.

### UIHandler interface

You MUST implement all four methods of the `UIHandler` interface:

```typescript
import type { UIHandler, UIHandlerConfig, UIRequest, UIResponse } from '@jaw.id/core';

class MyUIHandler implements UIHandler {
  private config: UIHandlerConfig | null = null;

  init?(config: UIHandlerConfig): void {
    // Called once when the SDK initializes
    // Store config for later use
    this.config = config;
  }

  async request<T>(request: UIRequest): Promise<UIResponse<T>> {
    // Called for every wallet interaction that needs user input
    // You MUST return a UIResponse with an id matching request.id
    // Implementation depends on request.type
    throw new Error('Not implemented');
  }

  canHandle?(request: UIRequest): boolean {
    // Return true if this handler can process the given request type
    return true;
  }

  async cleanup?(): Promise<void> {
    // Called when the SDK is destroyed
    // Clean up event listeners, DOM elements, timers, etc.
    this.config = null;
  }
}
```

### UIHandlerConfig

The `init` method receives a `UIHandlerConfig` with the SDK's configuration:

```typescript
interface UIHandlerConfig {
  apiKey: string;
  defaultChainId?: number;
  paymasters?: Record<number, { url: string; context?: Record<string, unknown> }>;
  appName?: string;
  appLogoUrl?: string | null;
  ens?: string;
  showTestnets?: boolean;
}
```

### Request types

Your `request` method must handle these methods:


| Type                       | Description                        | When triggered                       |
| -------------------------- | ---------------------------------- | ------------------------------------ |
| `wallet_connect`           | User connection / account creation | `connect()` or `eth_requestAccounts` |
| `personal_sign`            | Personal message signing (EIP-191) | `signMessage()`                      |
| `eth_signTypedData_v4`     | Typed data signing (EIP-712)       | `signTypedData()`                    |
| `wallet_sendCalls`         | Batch transaction approval         | `sendCalls()` or `sendTransaction()` |
| `wallet_grantPermissions`  | Permission grant approval          | `grantPermissions()`                 |
| `wallet_revokePermissions` | Permission revocation              | `revokePermissions()`                |
| `wallet_sign`              | Unified signing (ERC-7871)         | `useSign()`                          |


### UIResponse

You MUST return a `UIResponse` where `id` matches the incoming `request.id`. You MUST set `approved: true` with `data` for successful operations, or `approved: false` with an `error` for rejections.

```typescript
interface UIResponse<T> {
  id: string;       // MUST match request.id
  approved: boolean;
  data?: T;          // Response data when approved
  error?: UIError;   // Error when rejected
}
```

### UIError

You MUST use `UIError` static methods for standardized error responses:

```typescript
import { UIError } from '@jaw.id/core';

// User explicitly rejected the request
UIError.userRejected()    // EIP-1193 code 4001

// Request timed out waiting for user
UIError.timeout()

// Handler cannot process this request type
UIError.unsupportedRequest(request.type)
```

### Example: handling wallet_connect

Inside your `request` method, use `Account.create`, `Account.get`, or `Account.import` for passkey operations:

```typescript
import { Account, UIError } from '@jaw.id/core';
import type { UIRequest, UIResponse } from '@jaw.id/core';

async request(request: UIRequest): Promise<UIResponse> {
  if (request.type === 'wallet_connect') {
    try {
      // Show your custom connect UI (modal, page, etc.)
      const userChoice = await this.showConnectModal();

      if (userChoice === 'cancel') {
        return {
          id: request.id,
          approved: false,
          error: UIError.userRejected(),
        };
      }

      let account;
      if (userChoice.action === 'create') {
        account = await Account.create(
          { chainId: this.config!.defaultChainId ?? 1, apiKey: this.config!.apiKey },
          { username: userChoice.username },
        );
      } else if (userChoice.action === 'login') {
        account = await Account.get(
          { chainId: this.config!.defaultChainId ?? 1, apiKey: this.config!.apiKey },
          userChoice.credentialId,
        );
      } else {
        account = await Account.import(
          { chainId: this.config!.defaultChainId ?? 1, apiKey: this.config!.apiKey },
        );
      }

      return {
        id: request.id,
        approved: true,
        data: { address: account.address },
      };
    } catch (error) {
      return {
        id: request.id,
        approved: false,
        error: UIError.userRejected(),
      };
    }
  }

  // Handle other request types...
  return { id: request.id, approved: false, error: UIError.unsupportedRequest() };
}
```

### Example: handling transaction approval

```typescript
if (request.type === 'wallet_sendCalls') {
  const calls = request.data.calls; // Array of { to, value, data }

  // Show your custom transaction confirmation UI
  const userApproved = await this.showTransactionModal(calls);

  if (!userApproved) {
    return {
      id: request.id,
      approved: false,
      error: UIError.userRejected(),
    };
  }

  return {
    id: request.id,
    approved: true,
    data: calls, // Pass through the calls
  };
}
```

### Example: handling signing

```typescript
if (request.type === 'personal_sign') {
  const message = request.data.message; // Hex-encoded message to sign

  // Show your custom signing UI
  const userApproved = await this.showSignModal(message);

  return {
    id: request.id,
    approved: userApproved,
    error: userApproved ? undefined : UIError.userRejected(),
  };
}
```

### Registering the handler

```typescript
import { jaw } from '@jaw.id/wagmi';
import { Mode } from '@jaw.id/core';

const connector = jaw({
  apiKey: 'your-api-key',
  preference: {
    mode: Mode.AppSpecific,
    uiHandler: new MyUIHandler(),
  },
});
```

Or with core provider:

```typescript
import { JAW, Mode } from '@jaw.id/core';

const jaw = JAW.create({
  apiKey: 'your-api-key',
  preference: {
    mode: Mode.AppSpecific,
    uiHandler: new MyUIHandler(),
  },
});
```

### Key rules

- You MUST match `request.id` in every `UIResponse` -- mismatched IDs cause the SDK to hang waiting for a response.
- You MUST implement the `cleanup` method to release resources -- failing to clean up causes memory leaks.
- You MUST use `UIError.userRejected()` when the user cancels -- do not return raw error objects.
- You MUST use `UIError.unsupportedRequest()` for request types your handler does not support.
- You MUST provide a `UIHandler` when using `Mode.AppSpecific` -- the SDK throws without one.
- You MUST NOT use `Mode.AppSpecific` without implementing at least `wallet_connect` in your handler -- connection will fail.
- You MUST use `Account.create` / `Account.get` / `Account.import` inside your connect handler for passkey operations -- do not try to handle WebAuthn yourself.
- You MUST NOT block the `request` method indefinitely -- use `UIError.timeout()` if the user does not respond within a reasonable time.

### Common mistakes

Do NOT return a mismatched id:

```typescript
// Wrong -- id does not match request
return { id: 'some-other-id', approved: true };

// Correct
return { id: request.id, approved: true };
```

Do NOT return raw errors:

```typescript
// Wrong -- raw Error object
return { id: request.id, approved: false, error: new Error('cancelled') };

// Correct -- UIError
return { id: request.id, approved: false, error: UIError.userRejected() };
```

Do NOT forget cleanup:

```typescript
// Wrong -- resources leak
async cleanup(): Promise<void> {
  // empty
}

// Correct -- clean up everything
async cleanup(): Promise<void> {
  this.modal?.destroy();
  this.listeners.forEach(l => l.remove());
  this.config = null;
}
```

