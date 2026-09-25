## Gas Sponsoring

You MUST use the `paymasters` configuration to set up full gas sponsorship where the dApp pays transaction fees on behalf of users. You MUST NOT confuse this with ERC-20 gas payment (e.g., paying in USDC), which is built-in and requires no configuration — the user selects their preferred token in the dialog automatically.

### Gas payment options

| Option | Who Pays | Configuration |
|--------|----------|---------------|
| Native (ETH) | User | Default |
| ERC-20 Tokens (USDC, etc.) | User | Built-in — user selects token in dialog |
| Full Sponsorship | dApp | Requires `paymasters` config |

### Setup (wagmi)

You MUST pass the `paymasters` option to the `jaw()` connector, keyed by chain ID:

```typescript
import { jaw } from '@jaw.id/wagmi';

const connector = jaw({
  apiKey: 'YOUR_JAW_API_KEY',
  paymasters: {
    8453: { url: 'https://api.pimlico.io/v2/8453/rpc?apikey=YOUR_PIMLICO_KEY' },
  },
});
```

### Setup (core)

You MUST pass the `paymasters` option to `JAW.create()`, keyed by chain ID:

```typescript
import { JAW } from '@jaw.id/core';

const jaw = JAW.create({
  apiKey: 'YOUR_JAW_API_KEY',
  paymasters: {
    8453: { url: 'https://api.pimlico.io/v2/8453/rpc?apikey=YOUR_PIMLICO_KEY' },
  },
});
```

### Multi-chain sponsorship

You MUST add one entry per chain ID when sponsoring across multiple chains:

```typescript
paymasters: {
  1: { url: 'https://api.pimlico.io/v2/1/rpc?apikey=...' },       // Ethereum
  10: { url: 'https://api.pimlico.io/v2/10/rpc?apikey=...' },     // Optimism
  8453: { url: 'https://api.pimlico.io/v2/8453/rpc?apikey=...' }, // Base
  42161: { url: 'https://api.pimlico.io/v2/42161/rpc?apikey=...' }, // Arbitrum
},
```

### With sponsorship policies

You MUST use the `context` field to pass provider-specific sponsorship policy identifiers:

```typescript
paymasters: {
  8453: {
    url: 'https://api.pimlico.io/v2/8453/rpc?apikey=YOUR_KEY',
    context: { sponsorshipPolicyId: 'sp_your_policy_id' }, // Pimlico
  },
},
```

### Per-call paymaster override

You MUST use the `paymasterService` capability inside `wallet_sendCalls` to override the global paymaster for individual transactions:

```typescript
await jaw.provider.request({
  method: 'wallet_sendCalls',
  params: [{
    calls: [{ to: '0x...', data: '0x...' }],
    capabilities: {
      paymasterService: {
        url: 'https://different-paymaster.com',
        context: { sponsorshipPolicyId: 'special-policy' },
      },
    },
  }],
});
```

Priority: Per-call `paymasterService` > Global `paymasters` config > No sponsorship.

### Compatible providers

| Provider | Dashboard |
|----------|-----------|
| Pimlico | dashboard.pimlico.io |
| Etherspot | developer.etherspot.io/dashboard |

### Key rules

- You MUST use a paymaster that supports **EntryPoint v0.8** and **EIP-7677** — not all providers support this yet.
- You MUST NOT confuse ERC-20 gas payment (built-in, no config needed) with full sponsorship (requires `paymasters` config).
- You MUST check your provider's docs for the correct `context` keys — they are provider-specific.
- You MUST deposit funds in your paymaster provider dashboard before sponsoring transactions.
- You MUST create sponsorship policies in your provider's dashboard to control which transactions get sponsored.
