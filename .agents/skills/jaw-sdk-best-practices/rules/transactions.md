## Transactions

Sending single transactions, batch calls, gas estimation, and status tracking.

### Single transaction (wagmi)

```tsx
import { useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

function SendButton() {
  const { sendTransaction, isPending } = useSendTransaction();

  return (
    <button
      onClick={() => sendTransaction({
        to: '0xRecipient...',
        value: parseEther('0.01'),
      })}
      disabled={isPending}
    >
      Send 0.01 ETH
    </button>
  );
}
```

### Batch transactions (wagmi) — preferred

You MUST use `useSendCalls` for batching multiple operations in a single approval:

```tsx
import { useSendCalls } from 'wagmi';
import { parseEther, encodeFunctionData, erc20Abi } from 'viem';

function BatchSend() {
  const { sendCalls, isPending } = useSendCalls();

  const handleBatch = () => {
    sendCalls({
      calls: [
        { to: '0xAlice...', value: parseEther('0.01') },
        { to: '0xBob...', value: parseEther('0.02') },
        {
          to: '0xUSDC_ADDRESS...',
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: ['0xCharlie...', 1000000n], // 1 USDC
          }),
        },
      ],
    });
  };

  return <button onClick={handleBatch} disabled={isPending}>Batch Send</button>;
}
```

### Core provider transactions

```typescript
// Single transaction
const txHash = await jaw.provider.request({
  method: 'eth_sendTransaction',
  params: [{
    to: '0xRecipient...',
    value: '0x2386F26FC10000', // 0.01 ETH in hex
  }],
});

// Batch transactions
const result = await jaw.provider.request({
  method: 'wallet_sendCalls',
  params: [{
    calls: [
      { to: '0xAlice...', value: '0x2386F26FC10000' },
      { to: '0xBob...', value: '0x470DE4DF820000' },
    ],
  }],
});
```

### Account API transactions (headless)

```typescript
import { Account } from '@jaw.id/core';
import { parseEther, encodeFunctionData, erc20Abi } from 'viem';

const account = await Account.get({ chainId: 8453, apiKey: 'your-api-key' });

// sendTransaction — waits for receipt, returns tx hash
const hash = await account.sendTransaction([
  { to: '0xRecipient...', value: parseEther('0.1') }
]);

// sendCalls — returns immediately with user operation ID
const { id, chainId } = await account.sendCalls([
  { to: '0xAlice...', value: parseEther('0.01') },
  { to: '0xBob...', value: parseEther('0.02') },
]);
```

### Gas estimation

```typescript
const gas = await account.estimateGas([
  { to: '0xRecipient...', value: parseEther('0.1') }
]);
```

### Check batch status (Account API)

```typescript
const status = account.getCallStatus(batchId);
// status.status: 100=Pending, 200=Completed, 400=Offchain failure, 500=Onchain revert
```

### sendTransaction vs sendCalls


|          | `sendTransaction()` | `sendCalls()`           |
| -------- | ------------------- | ----------------------- |
| Returns  | Transaction hash    | User operation ID       |
| Waits    | Yes, until mined    | No, returns immediately |
| Use case | Need confirmation   | Fire and forget         |


### Key rules

- You MUST use `parseEther()` from viem to convert ETH amounts — never hardcode wei values manually.
- You MUST use `encodeFunctionData()` from viem to encode contract calls.
- You MUST use `wallet_sendCalls` (or `useSendCalls`) for batch operations — individual transactions cannot be batched.
- You MUST NOT assume a batch is complete just because `sendCalls` returned — poll with `getCallStatus`.
- All calls in a batch are atomic: they all succeed or all fail together.
- Users can pay gas in stablecoins by configuring the JAW ERC-20 paymaster — either
  globally via `paymasters` in the SDK config, or per-call via paymasterUrl/paymasterContext overrides. The token address must always be specified.
- For fully sponsored (gasless) transactions, configure `paymasters` in the SDK config.
- Value MUST be in wei (use `parseEther`, `parseUnits`, or hex strings).

### Common mistakes

You MUST NOT pass raw function call strings as `data`. This will not work:

```typescript
// Wrong — raw function call string won't work
{ to: USDC, data: 'transfer(0xAlice, 1000000)' }
```

You MUST use `encodeFunctionData` from viem instead:

```typescript
// Correct
import { encodeFunctionData, erc20Abi } from 'viem';
{
  to: USDC,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: ['0xAlice...', 1000000n],
  }),
}
```

