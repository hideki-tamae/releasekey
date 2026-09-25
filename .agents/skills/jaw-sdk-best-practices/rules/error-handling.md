## Error Handling

EIP-1193 error codes, common debugging patterns, and error recovery for JAW SDK operations.

### Standard EIP-1193 error codes

| Code | Name | Description |
|------|------|-------------|
| `4001` | User Rejected | User rejected the request (e.g., cancelled signing or transaction) |
| `4100` | Unauthorized | Requested method/account not authorized by the user |
| `4200` | Unsupported Method | Provider does not support the requested RPC method |
| `4900` | Disconnected | Provider is disconnected from all chains |
| `4901` | Chain Disconnected | Provider is disconnected from the specified chain |
| `4902` | Chain Not Recognized | Requested chain ID is not recognized or supported |

### Standard JSON-RPC error codes

| Code | Name | Description |
|------|------|-------------|
| `-32700` | Parse Error | Invalid JSON received |
| `-32600` | Invalid Request | JSON is valid but not a valid request object |
| `-32601` | Method Not Found | Method does not exist or is not available |
| `-32602` | Invalid Params | Invalid method parameters |
| `-32603` | Internal Error | Internal JSON-RPC error |

### Try/catch pattern for provider requests

You MUST wrap all provider requests in try/catch blocks. You MUST check the error `code` property to determine the error type and respond appropriately.

```typescript
import { JAW } from '@jaw.id/core';

const jaw = JAW.create({ apiKey: 'your-api-key' });

try {
  const result = await jaw.provider.request({
    method: 'wallet_sendCalls',
    params: [{
      calls: [{ to: '0xRecipient...', value: '0x2386F26FC10000' }],
    }],
  });
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const rpcError = error as { code: number; message: string };

    switch (rpcError.code) {
      case 4001:
        // User rejected -- this is normal, handle gracefully
        console.log('User cancelled the transaction');
        break;
      case 4100:
        // Not authorized -- user needs to connect first
        console.error('Not authenticated. Call connect() first.');
        break;
      case 4200:
        // Unsupported method
        console.error('Method not supported by this provider');
        break;
      case 4900:
        // Disconnected
        console.error('Wallet disconnected. Reconnect required.');
        break;
      case 4901:
        // Chain disconnected
        console.error('Chain disconnected. Switch chains or reconnect.');
        break;
      case 4902:
        // Chain not supported
        console.error('Chain not supported. Check supported networks.');
        break;
      default:
        console.error('RPC error:', rpcError.code, rpcError.message);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Try/catch pattern for wagmi hooks

```tsx
import { useSendCalls } from 'wagmi';

function SendButton() {
  const { sendCalls, isPending, error } = useSendCalls();

  const handleSend = () => {
    sendCalls({
      calls: [{ to: '0xRecipient...', value: parseEther('0.01') }],
    }, {
      onError: (error) => {
        if ('code' in error && error.code === 4001) {
          // User rejected -- show friendly message, not an error
          console.log('Transaction cancelled by user');
          return;
        }
        console.error('Transaction failed:', error.message);
      },
    });
  };

  return (
    <div>
      <button onClick={handleSend} disabled={isPending}>Send</button>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### Common errors and solutions

#### "Not authenticated"

The user has not connected their wallet. You MUST call `connect()` before calling any method that requires authentication (signing, transactions, permissions).

```typescript
// Wrong -- sending without connecting first
const hash = await account.sendTransaction([{ to: '0x...', value: parseEther('0.1') }]);

// Correct -- connect first, then send
const account = await Account.get(config, credentialId);
const hash = await account.sendTransaction([{ to: '0x...', value: parseEther('0.1') }]);
```

#### "Chain not supported" (4902)

The requested chain ID is not in the configured chains list. You MUST check that the chain is included in your wagmi config `chains` array, and if using a testnet, that `showTestnets` is enabled.

```typescript
// Check supported chains before switching
import { useSwitchChain } from 'wagmi';

const { switchChain, chains } = useSwitchChain();
const isSupported = chains.some(c => c.id === targetChainId);
if (isSupported) {
  switchChain({ chainId: targetChainId });
}
```

#### User rejection (4001)

This is not an error condition -- it means the user chose not to proceed. You MUST handle code `4001` gracefully without showing error states or retry prompts.

```typescript
try {
  await jaw.provider.request({ method: 'personal_sign', params: [message, address] });
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && (error as any).code === 4001) {
    // Not an error -- user chose to cancel
    return;
  }
  throw error; // Re-throw actual errors
}
```

#### WebAuthn errors

WebAuthn (passkey) operations can fail for browser-specific reasons. Common causes:

| Symptom | Cause | Solution |
|---------|-------|----------|
| No passkey prompt appears | Browser/OS does not support WebAuthn | Check `window.PublicKeyCredential` availability |
| Passkey prompt cancelled | User dismissed the system dialog | Handle as user rejection (gracefully) |
| Credential not found | Wrong `credentialId` or passkey deleted | Prompt user to create a new account or import |
| Operation timed out | User did not respond to passkey prompt | Retry with a new request |

### Pre-request authentication check

You MUST check authentication state before calling auth-required methods to provide a better UX than catching errors after the fact.

```tsx
import { useAccount } from 'wagmi';

function ProtectedAction() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return <p>Please connect your wallet first.</p>;
  }

  return <TransactionForm />;
}
```

### Key rules

- You MUST handle error code `4001` (User Rejected) gracefully -- user rejection is normal behavior, not an error condition. Do not show error toasts or retry prompts.
- You MUST check authentication state before calling auth-required methods -- show a connect prompt instead of catching "Not authenticated" errors.
- You MUST wrap all provider requests and hook calls in error handling -- unhandled rejections crash the application.
- You MUST NOT treat user rejection as a failure in analytics or logging -- it is an expected user action.
- You MUST NOT retry automatically after a `4001` rejection -- the user intentionally declined.
- You MUST check the `code` property on errors to distinguish between error types -- do not rely on message string matching.
- You MUST handle `4902` (Chain Not Recognized) by verifying the chain is in your config before operations that target a specific chain.
