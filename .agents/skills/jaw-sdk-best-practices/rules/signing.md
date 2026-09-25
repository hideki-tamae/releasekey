## Signing

Personal message signing (EIP-191), typed data signing (EIP-712), and the unified wallet_sign method (ERC-7871).

### Personal sign (wagmi)

```tsx
import { useSignMessage } from 'wagmi';

function SignButton() {
  const { signMessage, data: signature } = useSignMessage();
  return <button onClick={() => signMessage({ message: 'Hello World' })}>Sign</button>;
}
```

### Typed data signing (wagmi)

```tsx
import { useSignTypedData } from 'wagmi';

function SignTypedData() {
  const { signTypedData } = useSignTypedData();

  signTypedData({
    domain: { name: 'MyApp', version: '1', chainId: 1 },
    types: { Mail: [{ name: 'content', type: 'string' }] },
    primaryType: 'Mail',
    message: { content: 'Hello' },
  });
}
```

### Unified signing with useSign (recommended for JAW)

The `useSign` hook from `@jaw.id/wagmi` combines personal sign and typed data into one hook, with chain-specific signing support:

```tsx
import { useSign } from '@jaw.id/wagmi';

function UnifiedSign() {
  const { mutate: sign, data: signature } = useSign();

  // Personal sign (type 0x45)
  const handlePersonalSign = () => {
    sign({
      request: { type: '0x45', data: { message: 'Hello World' } },
    });
  };

  // Typed data sign (type 0x01)
  const handleTypedSign = () => {
    sign({
      request: {
        type: '0x01',
        data: {
          types: {
            EIP712Domain: [{ name: 'name', type: 'string' }],
            Mail: [{ name: 'content', type: 'string' }],
          },
          primaryType: 'Mail',
          domain: { name: 'MyApp' },
          message: { content: 'Hello' },
        },
      },
    });
  };

  // Cross-chain signing — sign for Base without switching chains
  const handleCrossChainSign = () => {
    sign({
      chainId: 8453, // Sign using Base smart account
      request: { type: '0x45', data: { message: 'Signed for Base' } },
    });
  };
}
```

### Account API signing (headless)

```typescript
import { Account } from '@jaw.id/core';

const account = await Account.get({ chainId: 1, apiKey: 'your-api-key' });

// Personal sign
const sig1 = await account.signMessage('Hello World');

// Typed data
const sig2 = await account.signTypedData({
  domain: { name: 'MyApp', version: '1', chainId: 1 },
  types: { Mail: [{ name: 'content', type: 'string' }] },
  primaryType: 'Mail',
  message: { content: 'Hello' },
});
```

### Core provider signing

```typescript
import { toHex } from 'viem';

// personal_sign
const sig = await jaw.provider.request({
  method: 'personal_sign',
  params: [toHex('Hello World'), account],
});

// wallet_sign (unified)
const sig2 = await jaw.provider.request({
  method: 'wallet_sign',
  params: [{ request: { type: '0x45', data: { message: 'Hello' } } }],
});
```

### Signature types

| Type Code | Standard | Description |
|-----------|----------|-------------|
| `0x45` | EIP-191 | Personal message signing |
| `0x01` | EIP-712 | Structured typed data signing |

### Key rules

- You MUST use `useSign` from `@jaw.id/wagmi` for new code -- it handles both personal and typed data, plus cross-chain signing.
- You MUST hex-encode messages when using `personal_sign` RPC directly -- use `toHex()` from viem.
- You MUST JSON-stringify typed data when using `eth_signTypedData_v4` RPC directly.
- You MUST NOT confuse the `chainId` parameter in `useSign` with the chain ID in an EIP-712 domain. The `chainId` parameter specifies which chain's smart account to use for signing; the EIP-712 domain chain ID is part of the typed data structure itself.
- You MUST use the `chainId` parameter in `useSign` for chain-specific signing. Smart accounts can produce different signatures per chain.
- You MUST NOT use `useSignMessage` or `useSignTypedData` from wagmi directly in JAW projects when `useSign` from `@jaw.id/wagmi` is available. The unified hook provides cross-chain signing that the individual wagmi hooks lack.
- You MUST NOT pass raw string messages to `personal_sign` at the RPC level. Always convert with `toHex()` first.
