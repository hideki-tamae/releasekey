## Upgrade EOA to Smart Account (EIP-7702)

EIP-7702 allows an EOA to delegate its code to a smart contract implementation, gaining smart account features (batching, permissions, gas sponsorship) while keeping the same address.

### When to use

| Scenario | Use EIP-7702? |
|----------|--------------|
| User has existing EOA with history/balances they want to keep | Yes |
| Integrating with Privy, Turnkey, or other embedded wallet providers | Yes |
| Server-side automation with a known private key | Yes |
| New user with no existing address | No — use `Account.create()` for passkey accounts or `Account.fromLocalAccount()` without `eip7702` |

### How it works

1. **First transaction** — The SDK signs an EIP-7702 authorization, registers the permissions manager as an owner, and executes your call — all in a single UserOperation.
2. **Subsequent transactions** — Delegation is already active. The SDK skips authorization and owner setup, just sends your call.

The developer does not handle any of this manually. Pass `{ eip7702: true }` and the SDK handles the rest.

### Basic usage

You MUST pass `{ eip7702: true }` as the third argument to `Account.fromLocalAccount()` to preserve the EOA address. Without it, a new counterfactual smart account address is created.

```typescript
import { Account } from '@jaw.id/core';
import { privateKeyToAccount } from 'viem/accounts';

const localAccount = privateKeyToAccount('0x...');

const account = await Account.fromLocalAccount(
  { chainId: 8453, apiKey: 'YOUR_API_KEY' },
  localAccount,
  { eip7702: true }
);

// account.address === localAccount.address
```

After creation, all Account methods work the same — `sendCalls`, `sendTransaction`, `signMessage`, `signTypedData`, `grantPermissions`, etc.

### Provider integrations

Any wallet provider that exposes a Viem `LocalAccount` works. The SDK handles authorization signing automatically — if the LocalAccount has `signAuthorization()`, it uses that (Tier 1). If not, it falls back to `hashAuthorization()` + `sign()` (Tier 2).

#### Privy (server)

```typescript
import { Account } from '@jaw.id/core';
import { PrivyClient } from '@privy-io/server-auth';
import { createViemAccount } from '@privy-io/server-auth/viem';

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
const wallet = await privy.walletApi.getWallet({ id: walletId });

const localAccount = await createViemAccount({
  walletId: wallet.id,
  address: wallet.address,
  privy,
});

const account = await Account.fromLocalAccount(
  { chainId: 8453, apiKey: 'YOUR_API_KEY' },
  localAccount,
  { eip7702: true }
);
```

#### Privy (client)

```typescript
import { Account } from '@jaw.id/core';
import { toViemAccount, getEmbeddedConnectedWallet } from '@privy-io/react-auth';

const embeddedWallet = getEmbeddedConnectedWallet(wallets);
const localAccount = await toViemAccount({ wallet: embeddedWallet });

const account = await Account.fromLocalAccount(
  { chainId: 8453, apiKey: 'YOUR_API_KEY' },
  localAccount,
  { eip7702: true }
);
```

#### Turnkey (server)

```typescript
import { Account } from '@jaw.id/core';
import { Turnkey } from '@turnkey/sdk-server';
import { createAccount } from '@turnkey/viem';

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  defaultOrganizationId: orgId,
  apiPublicKey: publicKey,
  apiPrivateKey: privateKey,
});

const localAccount = await createAccount({
  client: turnkey.apiClient(),
  organizationId: orgId,
  signWith: walletAddress,
});

const account = await Account.fromLocalAccount(
  { chainId: 8453, apiKey: 'YOUR_API_KEY' },
  localAccount,
  { eip7702: true }
);
```

### With gas sponsoring

EIP-7702 accounts work with paymasters. Pass the paymaster URL in config:

```typescript
const account = await Account.fromLocalAccount(
  {
    chainId: 8453,
    apiKey: 'YOUR_API_KEY',
    paymasterUrl: 'https://api.pimlico.io/v2/8453/rpc?apikey=YOUR_PIMLICO_KEY',
  },
  localAccount,
  { eip7702: true }
);

// Gas is fully sponsored
const { id } = await account.sendCalls([
  { to: '0xRecipient...', value: parseEther('0.1') }
]);
```

### With permissions

Grant scoped permissions so a backend or agent can execute on behalf of the user:

```typescript
// Owner grants permission
const response = await ownerAccount.grantPermissions(
  Math.floor(Date.now() / 1000) + 86400,
  spenderSmartAccountAddress,
  {
    calls: [{ target: USDC_ADDRESS, selector: '0xa9059cbb' }],
    spends: [{ token: USDC_ADDRESS, allowance: '1000000', unit: 'day' }],
  }
);

// Spender executes using the permission
const { id } = await spenderAccount.sendCalls(
  [{ to: USDC_ADDRESS, data: transferCalldata }],
  { permissionId: response.permissionId }
);
```

### EIP-7702 vs default fromLocalAccount

| | `fromLocalAccount(config, account)` | `fromLocalAccount(config, account, { eip7702: true })` |
|---|---|---|
| **Address** | New counterfactual address | Preserves the EOA address |
| **First tx** | Deploys via factory | Delegates via EIP-7702 authorization |
| **Identity** | New onchain identity | Same address, same history |
| **Use case** | Backend automation, session keys | Upgrade existing users, preserve reputation |

### Key rules

- You MUST pass `{ eip7702: true }` to preserve the EOA address — without it, a new address is created.
- You MUST NOT assume the LocalAccount needs `signAuthorization()` — the SDK falls back to `hashAuthorization()` + `sign()` automatically.
- You MUST NOT send the EIP-7702 authorization manually — the SDK handles it on the first transaction.
- You MUST NOT call `getMetadata()` on EIP-7702 accounts and expect passkey data — it returns `null`.
- You MUST grant permissions to the spender's **smart account address**, not their EOA address.
- You MUST use a paymaster that supports **EntryPoint v0.8** for gas sponsoring with EIP-7702.

### Common mistakes

Do NOT forget the `eip7702` flag:

```typescript
// Wrong — creates a new counterfactual address, not the EOA address
const account = await Account.fromLocalAccount(config, localAccount);

// Correct — preserves the EOA address
const account = await Account.fromLocalAccount(config, localAccount, { eip7702: true });
```

Do NOT grant permissions to the spender's EOA address:

```typescript
// Wrong — the spender's smart account sends the UserOp, not the EOA
await ownerAccount.grantPermissions(expiry, spenderEoa.address, permissions);

// Correct — use the spender's smart account address
const spenderAccount = await Account.fromLocalAccount(config, spenderKey);
await ownerAccount.grantPermissions(expiry, spenderAccount.address, permissions);
```
