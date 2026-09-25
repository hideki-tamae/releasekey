## Stablecoin Payments (Headless)

Headless stablecoin payment integration for fintechs, neobanks, and payment platforms. Uses the `Account` class directly with no JAW UI -- your application provides the entire user experience.

### When to use

Use headless stablecoin payments when you are building a fintech product, neobank, or payment service that needs stablecoin transfers without exposing any blockchain UI to end users. The JAW SDK handles smart account creation, transaction bundling, and gas abstraction while your app controls the UX.

### Install

```bash
npm install @jaw.id/core viem
```

### Account creation

You MUST create an account for each new user and store the returned `credentialId` in your backend, mapped to the user's identity. The `credentialId` is required to restore the account later.

```typescript
import { Account } from '@jaw.id/core';

const config = {
  chainId: 8453, // Base
  apiKey: process.env.JAW_API_KEY!,
};

// Create a new account for a user
const account = await Account.create(config, { username: 'alice@example.com' });

// Store this in your backend database: userId -> credentialId
const credentialId = account.getMetadata()!.credentialId;
console.log('Address:', account.address);
console.log('Credential ID:', credentialId);
```

### Account login

You MUST use `Account.get` with the stored `credentialId` to restore a returning user's account. This triggers WebAuthn authentication.

```typescript
import { Account } from '@jaw.id/core';

// Retrieve credentialId from your backend for this user
const credentialId = await getCredentialIdForUser(userId);

const account = await Account.get(
  { chainId: 8453, apiKey: process.env.JAW_API_KEY! },
  credentialId,
);

console.log('Restored address:', account.address);
```

### USDC transfer with gas paid in USDC

You MUST use `encodeFunctionData` from viem to encode ERC-20 transfer calls. You MUST use the JAW paymaster URL with a `token` context to enable gas payment in USDC (so users never need to hold ETH).

```typescript
import { Account, JAW_PAYMASTER_URL } from '@jaw.id/core';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`; // USDC on Base

const account = await Account.get(
  { chainId: 8453, apiKey: process.env.JAW_API_KEY! },
  credentialId,
);

const paymasterUrl = `${JAW_PAYMASTER_URL}?chainId=8453&api-key=${process.env.JAW_API_KEY!}`;

const { id } = await account.sendCalls(
  [{
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: ['0xRecipient...' as `0x${string}`, parseUnits('25', 6)], // 25 USDC
    }),
  }],
  undefined, // no permission options
  paymasterUrl,
  { token: USDC_ADDRESS }, // pay gas in USDC
);

console.log('Transaction ID:', id);
```

### Batch payments

You MUST batch multiple transfers into a single `sendCalls` invocation for atomicity and gas efficiency. All calls succeed or all fail together.

```typescript
import { Account, JAW_PAYMASTER_URL } from '@jaw.id/core';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

const recipients = [
  { address: '0xAlice...' as `0x${string}`, amount: '50' },
  { address: '0xBob...' as `0x${string}`, amount: '75' },
  { address: '0xCharlie...' as `0x${string}`, amount: '100' },
];

const calls = recipients.map(({ address, amount }) => ({
  to: USDC_ADDRESS,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [address, parseUnits(amount, 6)],
  }),
}));

const paymasterUrl = `${JAW_PAYMASTER_URL}?chainId=8453&api-key=${process.env.JAW_API_KEY!}`;

const { id } = await account.sendCalls(
  calls,
  undefined,
  paymasterUrl,
  { token: USDC_ADDRESS },
);

console.log('Batch transaction ID:', id);
```

### Check transaction status

You MUST poll `getCallStatus` after `sendCalls` to confirm completion -- `sendCalls` returns immediately and does not wait for the transaction to be mined.

```typescript
const status = account.getCallStatus(id);

switch (status.status) {
  case 100:
    console.log('Pending -- poll again');
    break;
  case 200:
    console.log('Completed successfully');
    console.log('Receipts:', status.receipts);
    break;
  case 400:
    console.log('Offchain failure');
    break;
  case 500:
    console.log('Onchain revert');
    break;
}
```

| Status Code | Meaning |
|-------------|---------|
| `100` | Pending -- transaction is being processed |
| `200` | Completed -- transaction mined successfully |
| `400` | Failed -- offchain failure (e.g., bundler rejected) |
| `500` | Reverted -- onchain execution reverted |

### Key rules

- You MUST manage the `username` to `credentialId` mapping in your backend -- the JAW SDK does not persist this for you.
- You MUST use `encodeFunctionData` from viem to encode ERC-20 transfer calls -- do not construct calldata manually.
- You MUST import `JAW_PAYMASTER_URL` from `@jaw.id/core` -- do not hardcode the paymaster URL.
- You MUST pass the `token` field in the paymaster context to enable gas payment in USDC.
- You MUST poll `getCallStatus` to confirm transaction completion -- `sendCalls` returns before the transaction is mined.
- You MUST NOT assume `sendCalls` returning means the transaction succeeded -- always check the status.
- You MUST NOT expose your JAW API key in client-side code -- keep it on the server.
- You MUST use `Account.create` for new users and `Account.get` with `credentialId` for returning users -- do not mix them up.

### Common mistakes

Do NOT forget to store the credentialId:

```typescript
// Wrong -- credentialId is lost, cannot restore account
const account = await Account.create(config, { username: 'alice' });
// account works now, but user can never log back in
```

Instead, persist it immediately:

```typescript
// Correct
const account = await Account.create(config, { username: 'alice' });
const metadata = account.getMetadata()!;
await db.users.update(userId, { credentialId: metadata.credentialId });
```

Do NOT pass raw amounts without encoding:

```typescript
// Wrong -- raw value, not encoded
{ to: USDC_ADDRESS, value: 25000000n }

// Correct -- use encodeFunctionData for ERC-20 transfers
{
  to: USDC_ADDRESS,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, parseUnits('25', 6)],
  }),
}
```
