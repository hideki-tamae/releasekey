## Connect & Disconnect

Connecting and disconnecting wallets using JAW. Covers both wagmi hooks and core provider.

### Basic connection (wagmi)

You MUST import `useConnect` and `useDisconnect` from `@jaw.id/wagmi`, NOT from `wagmi`. The `@jaw.id/wagmi` versions provide capabilities support that the vanilla wagmi hooks do not.

You MUST pass `connector` when calling `connect()` — it is a required parameter. You MUST NOT call `connect()` without a connector reference.

You MUST pass an empty object `{}` to `disconnect({})` — it requires a parameter. Calling `disconnect()` with no arguments will throw.

After disconnect, `useAccount` will reflect `isConnected: false` automatically. You MUST NOT manually reset connection state.

```tsx
import { useAccount } from 'wagmi';
import { useConnect, useDisconnect } from '@jaw.id/wagmi';
import { config } from './config';

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={() => disconnect({})}>Disconnect</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: config.connectors[0] })}
      disabled={isPending}
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
```

### Connection with SIWE (Sign-In With Ethereum)

You MUST use the `capabilities.signInWithEthereum` field on the `connect` call to request SIWE. 

You MUST provide a fresh `nonce` from your backend before initiating the connection.

You MUST verify the SIWE response on your backend after a successful connection. The signed message and signature are available on `data.accounts[0].capabilities?.signInWithEthereum`.

You MUST use `wallet_connect` (not `eth_requestAccounts`) when you need capabilities such as SIWE or subnames. The `eth_requestAccounts` method does not support capabilities.

```tsx
import { useConnect } from '@jaw.id/wagmi';

function SignInButton() {
  const { mutate: connect } = useConnect();

  const handleConnect = async () => {
    const nonceRes = await fetch('/api/siwe/nonce');
    const { nonce } = await nonceRes.json();

    connect({
      connector: config.connectors[0],
      capabilities: {
        signInWithEthereum: {
          nonce,
          chainId: '0x1',
          domain: window.location.host,
          uri: window.location.origin,
          statement: 'Sign in to My App',
        },
      },
    }, {
      onSuccess: async (data) => {
        const siweResponse = data.accounts[0].capabilities?.signInWithEthereum;
        if (iweResponse && 'signature' in siweResponse) {
          await fetch('/api/siwe/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: siweResponse.message,
              signature: siweResponse.signature,
            }),
          });
        }
      },
    });
  };

  return <button onClick={handleConnect}>Sign In with Ethereum</button>;
}
```

### Connection with ENS subname

You MUST ensure your API key has subname issuance enabled on the JAW dashboard  before requesting subnameTextRecords. There is no connector-level ENS configuration — eligibility is controlled at the API key level.

```tsx
import { useConnect } from '@jaw.id/wagmi';

function ConnectWithSubname() {
  const { mutate: connect } = useConnect();

  connect({
    connector: config.connectors[0], // jaw connector must have ens configured
    capabilities: {
      subnameTextRecords: [
        { key: 'avatar', value: 'https://myapp.com/avatar.png' },
        { key: 'description', value: 'My profile' },
      ],
    },
  });
}
```

### Core provider connection

When using the core provider directly (outside of React/wagmi), you MUST use `jaw.provider.request` with the `wallet_connect` method. You MUST NOT use `eth_requestAccounts` when you need capabilities.

```typescript
import { JAW } from '@jaw.id/core';

const jaw = JAW.create({ apiKey: 'your-api-key', appName: 'My App' });

// Simple connect
const accounts = await jaw.provider.request({
  method: 'wallet_connect',
  params: [{}],
});

// Disconnect
await jaw.provider.request({ method: 'wallet_disconnect' });
// Or: await jaw.disconnect();
```

### Key rules

- You MUST import `useConnect` and `useDisconnect` from `@jaw.id/wagmi` (not from `wagmi`) to get capabilities support.
- When using the useDisconnect hook, pass {} to disconnectWallet({}) by convention.
  The underlying action does not throw if the argument is omitted, but the hook's
  mutate function expects variables to be passed explicitly.You MUST pass `connector` when calling `connect()` — it is required.
- You MUST use `wallet_connect` (not `eth_requestAccounts`) when you need capabilities (SIWE, subnames).
- You MUST NOT call `connect()` without a connector reference.
- After disconnect, `useAccount` will reflect `isConnected: false` automatically.

