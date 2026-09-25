## Provider API

Direct EIP-1193 provider usage for non-React or advanced use cases. All methods are called through `jaw.provider.request()`.

### Setup

```typescript
import { JAW } from '@jaw.id/core';

const jaw = JAW.create({
  apiKey: 'YOUR_API_KEY',
  appName: 'My App',
});

// All requests go through provider.request()
const result = await jaw.provider.request({
  method: 'method_name',
  params: [...],
});
```

### Account methods

| Method | Description | Auth Required |
|--------|-------------|---------------|
| `eth_requestAccounts` | Trigger auth, return accounts | No (triggers auth) |
| `eth_accounts` | Get connected accounts (empty if not connected) | No |
| `wallet_connect` | Connect with capabilities (SIWE, subnames) | No (triggers auth) |
| `wallet_disconnect` | Disconnect session | No |

```typescript
// Simple auth — returns string[]
const accounts = await jaw.provider.request({
  method: 'eth_requestAccounts',
});

// Auth with capabilities — returns richer data
const result = await jaw.provider.request({
  method: 'wallet_connect',
  params: [{
    capabilities: {
      signInWithEthereum: {
        nonce: 'server-generated-nonce',
        chainId: '0x1',
        domain: window.location.host,
        uri: window.location.origin,
        statement: 'Sign in to My App',
      },
    },
  }],
});

// Get connected accounts without triggering auth
const connected = await jaw.provider.request({
  method: 'eth_accounts',
});

// Disconnect
await jaw.provider.request({ method: 'wallet_disconnect' });
```

### Transaction methods

| Method | Description | Auth Required |
|--------|-------------|---------------|
| `eth_sendTransaction` | Send single transaction | Yes |
| `wallet_sendCalls` | Send atomic batch of calls | No |
| `wallet_getCallsStatus` | Get batch status | No |
| `wallet_getCallsHistory` | Get call history for address | No |

```typescript
import { parseEther, encodeFunctionData, erc20Abi, numberToHex } from 'viem';

// Single transaction — value MUST be hex
const txHash = await jaw.provider.request({
  method: 'eth_sendTransaction',
  params: [{
    to: '0xRecipient...',
    value: numberToHex(parseEther('0.01')),
  }],
});

// Batch transactions — atomic, all-or-nothing
const batchResult = await jaw.provider.request({
  method: 'wallet_sendCalls',
  params: [{
    calls: [
      { to: '0xAlice...', value: numberToHex(parseEther('0.01')) },
      {
        to: '0xUSDC...',
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: ['0xBob...', 1000000n],
        }),
      },
    ],
  }],
});

// Check batch status
const status = await jaw.provider.request({
  method: 'wallet_getCallsStatus',
  params: [batchResult.id],
});

// Get call history for an address
const history = await jaw.provider.request({
  method: 'wallet_getCallsHistory',
  params: [{ address: '0xYourAddress...' }],
});
```

### Signing methods

| Method | Description | Auth Required |
|--------|-------------|---------------|
| `personal_sign` | EIP-191 personal message | Yes |
| `eth_signTypedData_v4` | EIP-712 typed data | Yes |
| `wallet_sign` | Unified signing (ERC-7871) | No |

```typescript
import { toHex } from 'viem';

// personal_sign — message MUST be hex-encoded
const sig1 = await jaw.provider.request({
  method: 'personal_sign',
  params: [toHex('Hello World'), account],
});

// eth_signTypedData_v4 — typed data MUST be JSON-stringified
const typedData = {
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Mail: [{ name: 'content', type: 'string' }],
  },
  primaryType: 'Mail',
  domain: { name: 'MyApp' },
  message: { content: 'Hello' },
};

const sig2 = await jaw.provider.request({
  method: 'eth_signTypedData_v4',
  params: [account, JSON.stringify(typedData)],
});

// wallet_sign (unified, recommended) — no hex encoding needed
const sig3 = await jaw.provider.request({
  method: 'wallet_sign',
  params: [{
    request: { type: '0x45', data: { message: 'Hello World' } },
  }],
});
```

### Chain methods

| Method | Description |
|--------|-------------|
| `eth_chainId` | Get current chain ID (hex) |
| `wallet_switchEthereumChain` | Switch chain |

```typescript
// Get current chain ID — returns hex string
const chainId = await jaw.provider.request({
  method: 'eth_chainId',
});

// Switch chain — chainId MUST be hex
await jaw.provider.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x2105' }], // Base (8453)
});
```

### Capability methods

| Method | Description |
|--------|-------------|
| `wallet_getCapabilities` | Get capabilities per chain (EIP-5792) |
| `wallet_getAssets` | Get token balances (EIP-7811) |

```typescript
// Get capabilities per chain
const capabilities = await jaw.provider.request({
  method: 'wallet_getCapabilities',
});

// Get token balances
const assets = await jaw.provider.request({
  method: 'wallet_getAssets',
  params: [{
    account: '0xYourAddress...',
  }],
});
```

### Permission methods

| Method | Description |
|--------|-------------|
| `wallet_grantPermissions` | Grant permissions |
| `wallet_revokePermissions` | Revoke permissions |
| `wallet_getPermissions` | Query permissions |

```typescript
import { parseUnits } from 'viem';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Grant permissions (ERC-7715)
const granted = await jaw.provider.request({
  method: 'wallet_grantPermissions',
  params: [{
    expiry: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    spender: '0xSpenderAddress...',
    permissions: {
      calls: [{ target: USDC, functionSignature: 'transfer(address,uint256)' }],
      spends: [{ token: USDC, allowance: '0x' + parseUnits('100', 6).toString(16), unit: 'month' }],
    },
  }],
});
// granted.permissionId -- store this

// Query permissions for the connected account
const permissions = await jaw.provider.request({
  method: 'wallet_getPermissions',
});

// Revoke a permission by ID
await jaw.provider.request({
  method: 'wallet_revokePermissions',
  params: [{ id: granted.permissionId }],
});
```

### Provider events

```typescript
// Account changes
jaw.provider.on('accountsChanged', (accounts: string[]) => {
  console.log('Accounts changed:', accounts);
});

// Chain changes
jaw.provider.on('chainChanged', (chainId: string) => {
  console.log('Chain changed:', chainId);
});

// Connection established
jaw.provider.on('connect', (info: { chainId: string }) => {
  console.log('Connected to chain:', info.chainId);
});

// Disconnection
jaw.provider.on('disconnect', (error: Error) => {
  console.log('Disconnected:', error.message);
});
```

### wallet_connect vs eth_requestAccounts

Use `wallet_connect` when you need capabilities (SIWE, subnames). Use `eth_requestAccounts` for simple auth. `wallet_connect` returns richer data including capabilities responses.

```typescript
// Simple auth — returns string[] of addresses
const accounts = await jaw.provider.request({
  method: 'eth_requestAccounts',
});

// Capabilities auth — returns accounts with capability responses
const result = await jaw.provider.request({
  method: 'wallet_connect',
  params: [{
    capabilities: {
      signInWithEthereum: { nonce: 'abc123', chainId: '0x1' },
    },
  }],
});
```

### Key rules

- You MUST use `wallet_connect` (not `eth_requestAccounts`) when you need SIWE or subname capabilities. `eth_requestAccounts` does not support capabilities.
- You MUST pass hex values for `eth_sendTransaction` fields (`value`, `chainId`, etc.) -- use `numberToHex()` from viem.
- You MUST hex-encode the message for `personal_sign` -- use `toHex()` from viem. Passing a raw string will fail.
- You MUST JSON-stringify typed data for `eth_signTypedData_v4` -- pass `JSON.stringify(typedData)` as the second param.
- You MUST pass the chain ID as a hex string to `wallet_switchEthereumChain` (e.g., `'0x2105'` for Base, not `8453`).
- You MUST NOT assume `wallet_sendCalls` has completed just because it returned -- poll with `wallet_getCallsStatus` to confirm.
- You MUST use `wallet_sendCalls` instead of multiple `eth_sendTransaction` calls when you need atomic batch execution.
- You MUST NOT mix up `personal_sign` param order -- the hex-encoded message comes first, the account address comes second.
- The provider is EIP-1193 compatible -- it works as a drop-in replacement for MetaMask or any standard wallet provider.
- You MUST NOT use `eth_accounts` to trigger authentication. It only returns accounts if the user is already connected. Use `eth_requestAccounts` or `wallet_connect` to initiate auth.

### Common mistakes

You MUST NOT pass a raw string to `personal_sign`:

```typescript
// Wrong -- raw string message
await jaw.provider.request({
  method: 'personal_sign',
  params: ['Hello World', account],
});
```

You MUST hex-encode the message with `toHex()`:

```typescript
// Correct
import { toHex } from 'viem';

await jaw.provider.request({
  method: 'personal_sign',
  params: [toHex('Hello World'), account],
});
```

You MUST NOT pass a decimal chain ID to `wallet_switchEthereumChain`:

```typescript
// Wrong -- decimal chain ID
await jaw.provider.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: 8453 }],
});
```

You MUST pass a hex string:

```typescript
// Correct
await jaw.provider.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x2105' }],
});
```
