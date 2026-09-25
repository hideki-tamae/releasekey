## Permissions

Granting, querying, and revoking permissions using JAW's ERC-7715 permission system. Permissions enable session keys, subscription payments, AI agent wallets, and delegated transactions.

### Grant permissions (wagmi)

You MUST use the `useGrantPermissions` hook from `@jaw.id/wagmi` to grant permissions in React components. You MUST provide `expiry` as a Unix timestamp in **seconds** (not milliseconds) -- use `Math.floor(Date.now() / 1000) + duration`. You MUST store the returned `permissionId` -- it is required to execute delegated calls and to revoke the permission later.

```tsx
import { useGrantPermissions } from '@jaw.id/wagmi';
import { parseUnits } from 'viem';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base

function GrantButton() {
  const { mutate: grant, data, isPending } = useGrantPermissions();

  const handleGrant = () => {
    grant({
      end: Math.floor(Date.now() / 1000) + 86400 * 7, // 1 week
      spender: '0xYourBackendWallet...',
      permissions: {
        calls: [{
          target: USDC,
          functionSignature: 'transfer(address,uint256)',
        }],
        spends: [{
          token: USDC,
          allowance: parseUnits('100', 6).toString(), // 100 USDC
          unit: 'day',
        }],
      },
    }, {
      onSuccess: (data) => {
        console.log('Permission ID:', data.permissionId);
        // Store permissionId in your backend!
      },
    });
  };

  return <button onClick={handleGrant} disabled={isPending}>Grant Permission</button>;
}
```

### Query permissions (wagmi)

You MUST use the `usePermissions` hook from `@jaw.id/wagmi` to list active permissions for the connected wallet.

```tsx
import { usePermissions } from '@jaw.id/wagmi';

function PermissionsList() {
  const { data: permissions, isLoading } = usePermissions();

  if (isLoading) return <p>Loading...</p>;
  return (
    <ul>
      {permissions?.map((p) => (
        <li key={p.permissionId}>
          Spender: {p.spender} | Expires: {new Date(p.end * 1000).toLocaleDateString()}
        </li>
      ))}
    </ul>
  );
}
```

### Revoke permissions (wagmi)

You MUST use the `useRevokePermissions` hook from `@jaw.id/wagmi` to revoke a permission. Revocation is permanent -- once revoked, the permission cannot be restored. Revocation requires an on-chain transaction (gas cost, unless a paymaster is configured).

```tsx
import { useRevokePermissions } from '@jaw.id/wagmi';

function RevokeButton({ permissionId }: { permissionId: `0x${string}` }) {
  const { mutate: revoke, isPending } = useRevokePermissions();
  return (
    <button onClick={() => revoke({ id: permissionId })} disabled={isPending}>
      Revoke
    </button>
  );
}
```

### Permission parameters

#### calls -- what functions the spender can call

You MUST provide either `functionSignature` or `selector` for each call permission -- one is required, but you MUST NOT provide both. Use `functionSignature` for readability -- the SDK computes the selector automatically.

```typescript
permissions: {
  calls: [{
    target: USDC_ADDRESS,
    functionSignature: 'transfer(address,uint256)', // human-readable -- SDK computes selector
    // OR: selector: '0xa9059cbb'  // raw 4-byte selector
  }],
}
```

#### spends -- token spending limits per time period

You MUST include `spends` if the permission involves moving funds (token transfers). You MUST NOT omit the spend limit when granting transfer or approve call permissions.

```typescript
permissions: {
  spends: [{
    token: USDC_ADDRESS,
    allowance: parseUnits('100', 6).toString(), // 100 USDC
    unit: 'month',          // 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'forever'
    multiplier: 1,          // optional, 1–65535 E.g., unit:'week', multiplier:2 = every 2 weeks
  }],
}
```

#### Native ETH spending

You MUST use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (ERC-7528) as the token address for native ETH in spend permissions. You MUST NOT use the zero address or any other placeholder for native ETH.

```typescript
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // ERC-7528
permissions: {
  spends: [{
    token: NATIVE_TOKEN,
    allowance: parseEther('0.1').toString(), // 0.1 ETH per day
    unit: 'day',
  }],
}
```

### Execute calls with a permission (server-side)

You MUST use `Account.fromLocalAccount()` with a private key for server-side permission execution. You MUST pass the `permissionId` in the options of `sendCalls`. You MUST NOT attempt to execute delegated calls without a valid, non-revoked permission ID.

```typescript
import { Account } from '@jaw.id/core';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

const spenderAccount = privateKeyToAccount(process.env.SPENDER_PRIVATE_KEY as `0x${string}`);
const account = await Account.fromLocalAccount(
  { chainId: 8453, apiKey: process.env.JAW_API_KEY! },
  spenderAccount
);

const { id } = await account.sendCalls(
  [{
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: ['0xTreasury...', parseUnits('10', 6)],
    }),
  }],
  { permissionId: '0xPermissionHash...' as `0x${string}` }
);
```

### Core provider permissions

You MUST use these ERC-7715 JSON-RPC methods when working with the core provider directly instead of wagmi hooks.

```typescript
// Grant
const result = await jaw.provider.request({
  method: 'wallet_grantPermissions',
  params: [{ expiry, spender, permissions: { calls, spends } }],
});

// Query
const perms = await jaw.provider.request({
  method: 'wallet_getPermissions',
  params: [{ address: '0x...' }],
});

// Revoke
await jaw.provider.request({
  method: 'wallet_revokePermissions',
  params: [{ id: permissionId }],
});
```

### Key rules

- You MUST store `permissionId` from the grant response -- it is required to execute delegated calls and to revoke.
- You MUST provide `expiry` as a Unix timestamp in seconds (not milliseconds) -- use `Math.floor(Date.now() / 1000) + duration`.
- You MUST provide either `functionSignature` or `selector` for each call permission -- one is required. If both are provided, `selector` takes priority and `functionSignature` is ignored.
- You MUST include `spends` if the permission involves moving funds (token transfers).
- You MUST use `Account.fromLocalAccount()` with a private key for server-side permission execution.
- You MUST NOT attempt to re-grant a revoked permission -- revocation is permanent and irreversible.
- You MUST NOT forget that revocation requires an on-chain transaction (gas cost, unless a paymaster is configured).
- You MUST use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native ETH in spend permissions (ERC-7528).
- You MUST revoke permissions on the correct chain where they were granted -- permissions are chain-specific.

