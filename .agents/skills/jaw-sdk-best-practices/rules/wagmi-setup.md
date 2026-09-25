## Wagmi Setup

Setting up the JAW connector with wagmi for React/Next.js applications, and using standard wagmi hooks alongside JAW-specific hooks.

### 1. Create wagmi config

```typescript
// config.ts
import { createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { jaw } from '@jaw.id/wagmi';

export const config = createConfig({
  chains: [mainnet, base],
  connectors: [
    jaw({
      apiKey: 'YOUR_API_KEY',
      appName: 'My App',
      appLogoUrl: 'https://myapp.com/logo.png',
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});
```

### 2. Wrap app with providers

```tsx
// App.tsx
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config';

const queryClient = new QueryClient();

function App({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Standard wagmi hooks that work with JAW

All standard wagmi hooks work with the JAW connector. Import directly from `wagmi`:

```typescript
import {
  useAccount,         // Get connected account address and status
  useSendTransaction, // Send a single transaction
  useSignMessage,     // Sign a personal message (EIP-191)
  useSignTypedData,   // Sign typed data (EIP-712)
  useSwitchChain,     // Switch to a different chain
  useSendCalls,       // Send atomic batch transactions (EIP-5792)
  useWriteContract,   // Call a contract write function
  useBalance,         // Get ETH or token balance
} from 'wagmi';
```

When a paymaster is configured, transactions via `useSendTransaction`, `useSendCalls`, and `useWriteContract` are automatically sponsored (gasless).

### JAW-specific hooks (import from @jaw.id/wagmi)

```typescript
import {
  useConnect,           // Connect with optional capabilities (SIWE, subnames)
  useDisconnect,        // Disconnect and clean up session
  useSign,              // Unified signing (personal + typed data) with chain support
  useGrantPermissions,  // Grant permissions to a spender
  usePermissions,       // Query current permissions
  useRevokePermissions, // Revoke a permission
  useGetAssets,         // Query token balances across chains
  useCapabilities,      // Query wallet capabilities per chain
  useGetCallsHistory,   // Get transaction history
} from '@jaw.id/wagmi';
```

### JAW connector properties

The JAW connector has these standard properties:

| Property | Value |
|----------|-------|
| `id` | `'jaw'` |
| `name` | `'JAW'` |
| `type` | `'jaw'` |

### Why use @jaw.id/wagmi's useConnect over wagmi's?

| Feature | `wagmi.useConnect` | `@jaw.id/wagmi.useConnect` |
|---------|-------------------|---------------------------|
| Basic connection | Yes | Yes |
| SIWE during connect | No | Yes |
| Subname issuance | No | Yes |
| Uses `wallet_connect` | No | When capabilities provided |

For basic connections without capabilities, either `useConnect` works. Use `@jaw.id/wagmi`'s `useConnect` when you need capabilities like SIWE or subnames during connection.

### Vanilla JS / Non-React usage

For non-React apps, use actions directly:

```typescript
import { connect, disconnect, grantPermissions } from '@jaw.id/wagmi';

await connect(config, { connector: jawConnector });
```

### Key rules

- You MUST wrap your app with both `WagmiProvider` and `QueryClientProvider`.
- You MUST define `transports` for every chain in the `chains` array.
- You MUST import JAW-specific hooks (`useConnect`, `useDisconnect`, `useSign`, `useGrantPermissions`, `usePermissions`, `useRevokePermissions`, `useGetAssets`, `useCapabilities`, `useGetCallsHistory`) from `@jaw.id/wagmi`, NOT from `wagmi`.
- You MUST import standard hooks (`useAccount`, `useSendTransaction`, `useSignMessage`, `useSignTypedData`, `useSwitchChain`, `useSendCalls`, `useWriteContract`, `useBalance`) from `wagmi`.
- You MUST NOT import `useConnect` or `useDisconnect` from `wagmi` when using JAW-specific capabilities like SIWE or subnames.
- You MUST NOT omit the `QueryClientProvider` -- wagmi hooks depend on `@tanstack/react-query` internally.
- You MUST NOT forget to add a transport entry for each chain -- missing transports cause silent connection failures.
- Do NOT mix JAW-specific hook imports with standard wagmi imports from the same package -- keep them separated by source.

### Common mistakes

Do NOT forget transports for a chain in the config:
```typescript
// Wrong -- base has no transport defined
export const config = createConfig({
  chains: [mainnet, base],
  connectors: [jaw({ apiKey: 'key' })],
  transports: {
    [mainnet.id]: http(),
    // Missing: [base.id]: http()
  },
});
```

Instead, define transports for every chain:
```typescript
// Correct
export const config = createConfig({
  chains: [mainnet, base],
  connectors: [jaw({ apiKey: 'key' })],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});
```

Do NOT import JAW-specific hooks from `wagmi`:
```typescript
// Wrong -- useConnect from wagmi lacks JAW capabilities
import { useConnect } from 'wagmi';
```

Instead, import from `@jaw.id/wagmi` when you need JAW features:
```typescript
// Correct
import { useConnect } from '@jaw.id/wagmi';
```
