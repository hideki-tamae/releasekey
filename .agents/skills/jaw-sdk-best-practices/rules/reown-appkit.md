## Reown AppKit Integration

Adding JAW passkey smart accounts to an existing Reown AppKit project. The JAW connector is passed into Reown's `WagmiAdapter` so both JAW and AppKit wallets share one wagmi config.

### Install

Add `@jaw.id/wagmi` to your existing Reown AppKit project:

```bash
npm install @jaw.id/wagmi
```

### Create the connector and pass to WagmiAdapter

You MUST pass the JAW connector in the `connectors` array of `WagmiAdapter`:

```typescript
import { cookieStorage, createStorage, http } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { baseSepolia, base } from "@reown/appkit/networks";
import { jaw } from "@jaw.id/wagmi";

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;
if (!projectId) throw new Error("NEXT_PUBLIC_PROJECT_ID is not defined");

export const networks = [baseSepolia, base];

const jawConnector = jaw({
  apiKey: process.env.NEXT_PUBLIC_JAW_API_KEY!,
  appName: "My App",
  defaultChainId: baseSepolia.id,
  preference: { showTestnets: true },
});

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
  connectors: [jawConnector],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

export const config = wagmiAdapter.wagmiConfig;
```

### Connect with JAW alongside AppKit

Use `useConnect` / `useDisconnect` from `@jaw.id/wagmi` for the passkey button. Reown's `<appkit-button />` handles its own connection independently. Both share the same wagmi state.

```tsx
import { useAccount } from "wagmi";
import { useConnect, useDisconnect } from "@jaw.id/wagmi";
import { config } from "@/config";

function Page() {
  const { address, isConnected } = useAccount();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();

  return (
    <div>
      {isConnected ? (
        <>
          <p>{address}</p>
          <button onClick={() => disconnect({})}>Disconnect</button>
        </>
      ) : (
        <button onClick={() => connect({ connector: config.connectors[0] })} disabled={isPending}>
          Connect with JAW
        </button>
      )}
      <appkit-button />
    </div>
  );
}
```

### Key rules

- You MUST pass `jawConnector` in the `connectors` array of `WagmiAdapter`, NOT in a separate `createConfig` call.
- You MUST use `wagmiAdapter.wagmiConfig` as the single config source — do NOT create a second config with `createConfig`.
- You MUST import chain definitions from `@reown/appkit/networks` (not `wagmi/chains`) when using them in the `WagmiAdapter`'s `networks` array.
- You MUST import `useConnect` and `useDisconnect` from `@jaw.id/wagmi` for the JAW passkey button.
- You MUST set `ssr: true` and use `cookieStorage` in the `WagmiAdapter` for Next.js SSR hydration.
- You MUST enable `preference.showTestnets: true` when using a testnet `defaultChainId` (e.g., `baseSepolia.id`).
- All standard wagmi hooks work with both JAW and AppKit wallets once connected — no connector-specific logic needed.
- The rest of the Reown setup (context provider, `createAppKit`, layout) stays unchanged.

### Common mistakes

Do NOT create a separate wagmi config alongside the adapter:

```typescript
// Wrong — two competing configs
const config = createConfig({ ... });
const wagmiAdapter = new WagmiAdapter({ ... });
```

Instead, use the adapter's config:

```typescript
// Correct
export const wagmiAdapter = new WagmiAdapter({ ... });
export const config = wagmiAdapter.wagmiConfig;
```

Do NOT import chains from `wagmi/chains` for the adapter's `networks`:

```typescript
// Wrong
import { base } from "wagmi/chains";
new WagmiAdapter({ networks: [base], ... });
```

Instead:

```typescript
// Correct
import { base } from "@reown/appkit/networks";
new WagmiAdapter({ networks: [base], ... });
```
