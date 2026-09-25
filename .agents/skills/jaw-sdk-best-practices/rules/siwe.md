## Sign-In With Ethereum (SIWE)

Authenticating users by signing a standardized message with their wallet. SIWE connects wallet ownership to a backend session.

### Backend endpoints

You MUST implement three backend endpoints for SIWE:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/siwe/nonce` | GET | Generate and return a fresh nonce |
| `/api/siwe/verify` | POST | Verify the signed SIWE message and create a session |
| `/api/siwe/logout` | POST | Destroy the session |

### Nonce generation

You MUST generate a fresh, cryptographically random nonce for every SIWE request. You MUST store the nonce server-side (e.g., in session or cache) to verify it later. You MUST NOT reuse nonces -- each sign-in attempt requires a new one.

```typescript
import { generateSiweNonce } from 'viem/siwe';

// GET /api/siwe/nonce
export async function handleNonce(req: Request, res: Response) {
  const nonce = generateSiweNonce();
  // Store nonce in session for later verification
  req.session.siweNonce = nonce;
  res.json({ nonce });
}
```

### Verification

You MUST verify SIWE signatures on your backend -- never trust client-side verification alone. You MUST use `parseSiweMessage()` and `verifySiweMessage()` from `viem/siwe`. You MUST check that the nonce in the message matches the one you stored server-side. You MUST set an expiration time on the SIWE message to prevent replay attacks.

```typescript
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// POST /api/siwe/verify
export async function handleVerify(req: Request, res: Response) {
  const { message, signature } = req.body;

  const parsedMessage = parseSiweMessage(message);

  // Verify nonce matches what we issued
  if (parsedMessage.nonce !== req.session.siweNonce) {
    return res.status(401).json({ error: 'Invalid nonce' });
  }

  const valid = await verifySiweMessage(publicClient, {
    message,
    signature,
  });

  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Create session
  req.session.address = parsedMessage.address;
  req.session.chainId = parsedMessage.chainId;
  delete req.session.siweNonce; // Consume the nonce

  res.json({ address: parsedMessage.address });
}
```

### Logout

```typescript
// POST /api/siwe/logout
export async function handleLogout(req: Request, res: Response) {
  req.session.destroy();
  res.json({ success: true });
}
```

### Client-side: connect with SIWE (wagmi)

You MUST use the `signInWithEthereum` capability in `useConnect` from `@jaw.id/wagmi`. You MUST provide `nonce` (fetched from your backend) and `chainId` (as a hex string). You MUST verify the response on your backend after successful connection.

```tsx
import { useConnect } from '@jaw.id/wagmi';
import { config } from './config';

function SiweButton() {
  const { mutate: connect, isPending } = useConnect();

  const handleSignIn = async () => {
    // 1. Fetch fresh nonce from backend
    const nonceRes = await fetch('/api/siwe/nonce');
    const { nonce } = await nonceRes.json();

    // 2. Connect with SIWE capability
    connect({
      connector: config.connectors[0],
      capabilities: {
        signInWithEthereum: {
          nonce,
          chainId: '0x1', // Required, hex-encoded chain ID
          domain: window.location.host,
          uri: window.location.origin,
          statement: 'Sign in to My App',
          expirationTime: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 minutes
        },
      },
    }, {
      onSuccess: async (data) => {
        // 3. Verify on backend
        const siweResponse = data.accounts[0].capabilities?.signInWithEthereum;
        if (siweResponse && 'message' in siweResponse) {
          const verifyRes = await fetch('/api/siwe/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: siweResponse.message,
              signature: siweResponse.signature,
            }),
          });
          if (!verifyRes.ok) {
            console.error('SIWE verification failed');
          }
        }
      },
    });
  };

  return (
    <button onClick={handleSignIn} disabled={isPending}>
      {isPending ? 'Signing in...' : 'Sign In with Ethereum'}
    </button>
  );
}
```

### Client-side: core provider

```typescript
import { JAW } from '@jaw.id/core';

const jaw = JAW.create({ apiKey: 'your-api-key' });

const nonceRes = await fetch('/api/siwe/nonce');
const { nonce } = await nonceRes.json();

const result = await jaw.provider.request({
  method: 'wallet_connect',
  params: [{
    capabilities: {
      signInWithEthereum: {
        nonce,
        chainId: '0x1',
        domain: window.location.host,
        uri: window.location.origin,
        statement: 'Sign in to My App',
        expirationTime: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
      },
    },
  }],
});
```

### SIWE parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nonce` | `string` | Yes | Fresh random nonce from backend |
| `chainId` | `string` | Yes | Hex-encoded chain ID (e.g., `'0x1'`, `'0x2105'`) |
| `domain` | `string` | No | Domain requesting the sign-in (e.g., `window.location.host`) |
| `uri` | `string` | No | URI of the requesting application |
| `statement` | `string` | No | Human-readable message shown to the user |
| `expirationTime` | `string` | No | ISO 8601 datetime after which the message is invalid |

### Key rules

- You MUST verify SIWE signatures on your backend -- client-side verification alone is insecure.
- You MUST use fresh nonces for every sign-in attempt -- generate with `generateSiweNonce()` from `viem/siwe`.
- You MUST set `expirationTime` on SIWE messages to prevent replay attacks.
- You MUST pass `chainId` as a hex string (e.g., `'0x1'`), not a number.
- You MUST use `wallet_connect` (or `useConnect` from `@jaw.id/wagmi`) to request SIWE -- `eth_requestAccounts` does not support capabilities.
- You MUST consume the nonce after successful verification -- do not allow it to be reused.
- You MUST NOT store SIWE nonces in client-side storage -- they belong on the server.
- You MUST NOT skip nonce validation during verification -- this is the primary defense against replay attacks.

### Common mistakes

Do NOT use `eth_requestAccounts` for SIWE:

```typescript
// Wrong -- eth_requestAccounts does not support capabilities
const accounts = await jaw.provider.request({
  method: 'eth_requestAccounts',
});
```

Instead, use `wallet_connect`:

```typescript
// Correct
const result = await jaw.provider.request({
  method: 'wallet_connect',
  params: [{
    capabilities: {
      signInWithEthereum: { nonce, chainId: '0x1' },
    },
  }],
});
```

Do NOT pass `chainId` as a number:

```typescript
// Wrong -- chainId must be a hex string
signInWithEthereum: { nonce, chainId: 1 }

// Correct
signInWithEthereum: { nonce, chainId: '0x1' }
```
