## Subscription Payments

Recurring payments using JAW permissions. Permissions enable time-limited, amount-capped delegation so a service can charge users periodically without requiring per-transaction approval.

### The problem

In traditional crypto, every transaction requires explicit user approval. This makes recurring payments (subscriptions, memberships, metered billing) impractical -- the user must be present and approve each charge.

### The solution

JAW permissions (ERC-7715) let a user grant a spender (your backend) the right to execute specific calls within defined spending limits and time windows. Once granted, the spender can charge the user at the agreed interval with no user interaction required.

### Subscription flow

1. **User subscribes** -- your frontend grants a permission (e.g., $10 USDC/month for 12 months)
2. **Store permissionId** -- your backend persists the `permissionId` from the grant response
3. **Monthly charge** -- a cron job or billing service uses the `permissionId` to transfer USDC (no user interaction)
4. **User cancels** -- user revokes the permission at any time, immediately stopping future charges

### Step 1: Grant permission (frontend)

You MUST use `useGrantPermissions` from `@jaw.id/wagmi` to request subscription authorization from the user. You MUST store the returned `permissionId` in your backend database.

```tsx
import { useGrantPermissions } from '@jaw.id/wagmi';
import { parseUnits } from 'viem';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base

function SubscribeButton({ spenderAddress }: { spenderAddress: `0x${string}` }) {
  const { mutate: grant, isPending } = useGrantPermissions();

  const handleSubscribe = () => {
    grant({
      expiry: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year
      spender: spenderAddress,
      permissions: {
        calls: [{
          target: USDC,
          functionSignature: 'transfer(address,uint256)',
        }],
        spends: [{
          token: USDC,
          allowance: parseUnits('10', 6).toString(), // 10 USDC per month
          unit: 'month',
        }],
      },
    }, {
      onSuccess: async (data) => {
        // Store permissionId in your backend
        await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permissionId: data.permissionId,
            account: data.account,
            spender: data.spender,
            chainId: data.chainId,
          }),
        });
      },
    });
  };

  return (
    <button onClick={handleSubscribe} disabled={isPending}>
      {isPending ? 'Approving...' : 'Subscribe ($10/month)'}
    </button>
  );
}
```

### Step 2: Charge the user (server-side)

You MUST use `Account.fromLocalAccount()` with the spender's private key to execute charges on behalf of the user. You MUST pass the stored `permissionId` in the options of `sendCalls`. The spender private key MUST be securely stored (e.g., in a secrets manager or HSM) -- never in source code or environment files accessible to the frontend.

```typescript
import { Account } from '@jaw.id/core';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TREASURY = '0xYourTreasuryAddress...' as `0x${string}`;

async function chargeSubscription(permissionId: `0x${string}`) {
  const spenderAccount = privateKeyToAccount(
    process.env.SPENDER_PRIVATE_KEY as `0x${string}`
  );

  const account = await Account.fromLocalAccount(
    { chainId: 8453, apiKey: process.env.JAW_API_KEY! },
    spenderAccount,
  );

  const { id } = await account.sendCalls(
    [{
      to: USDC,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [TREASURY, parseUnits('10', 6)],
      }),
    }],
    { permissionId },
  );

  // Check status
  const status = account.getCallStatus(id);
  // status.status: 100=Pending, 200=Completed, 400=Failed, 500=Reverted
  return status;
}
```

### Step 3: Cancel subscription (frontend)

You MUST use `useRevokePermissions` from `@jaw.id/wagmi` to let users cancel their subscription. Revocation is permanent and on-chain -- once revoked, the spender can no longer execute calls under that permission.

```tsx
import { useRevokePermissions } from '@jaw.id/wagmi';

function CancelSubscriptionButton({ permissionId }: { permissionId: `0x${string}` }) {
  const { mutate: revoke, isPending } = useRevokePermissions();

  const handleCancel = async () => {
    revoke({ id: permissionId }, {
      onSuccess: async () => {
        await fetch('/api/subscriptions/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionId }),
        });
      },
    });
  };

  return (
    <button onClick={handleCancel} disabled={isPending}>
      {isPending ? 'Cancelling...' : 'Cancel Subscription'}
    </button>
  );
}
```

### Key rules

- You MUST store the `permissionId` in your backend after granting -- it is required for every future charge.
- You MUST secure the spender private key in a secrets manager or HSM -- never expose it in client-side code, source control, or frontend-accessible environment variables.
- You MUST set the permission `expiry` to match or exceed the subscription duration -- an expired permission cannot be used for charges.
- You MUST use `Account.fromLocalAccount()` with the spender's private key for server-side charges.
- You MUST use `encodeFunctionData` from viem to encode the ERC-20 `transfer` call -- do not pass raw calldata strings.
- You MUST handle charge failures gracefully -- check `getCallStatus` and implement retry logic for status `100` (Pending) and alerting for status `400`/`500`.
- You MUST NOT charge more than the `allowance` within the `unit` time window -- the transaction will revert.
- You MUST NOT assume a revoked permission can be re-granted with the same ID -- revocation is permanent.
- You MUST update your backend when a user revokes a subscription to stop future charge attempts.

### Common mistakes

Do NOT forget to store the permissionId:

```typescript
// Wrong -- permissionId is lost, cannot charge later
grant({ expiry, spender, permissions }, {
  onSuccess: (data) => {
    console.log('Granted!'); // permissionId not saved
  },
});
```

Do NOT hardcode the spender private key:

```typescript
// Wrong -- private key in source code
const spender = privateKeyToAccount('0xac0974bec...');

// Correct -- load from secrets manager
const spender = privateKeyToAccount(process.env.SPENDER_PRIVATE_KEY as `0x${string}`);
```
