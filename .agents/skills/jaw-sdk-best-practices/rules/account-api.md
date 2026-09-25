## Account API (Headless / Server-Side / AI Agents)

The `Account` class provides direct smart account operations without React, wagmi, or any UI layer. Use it for AI agent wallets, headless integrations, server-side automation, and custom UI handlers.

### When to use

| Scenario | Use Account API? |
|----------|-----------------|
| AI agent wallets | Yes |
| Server-side automation | Yes |
| Headless fintech/payments | Yes |
| Custom UI (AppSpecific mode) | Yes |
| React app with wagmi | No -- use wagmi hooks |

### Install

```bash
npm install @jaw.id/core viem
```

### Import

```typescript
import { Account } from '@jaw.id/core';
```

### AccountConfig

Every `Account` factory method requires an `AccountConfig`:

```typescript
interface AccountConfig {
  chainId: number;           // Target chain ID (e.g., 8453 for Base)
  apiKey: string;            // API key from dashboard.jaw.id
  paymasterUrl?: string;     // Paymaster URL for gas sponsoring
  paymasterContext?: Record<string, unknown>; // Provider-specific paymaster options
}
```

> Building on React Native? `AccountConfig` takes additional fields (`storage`, `nativeGetFn`, `nativeCreateFn`, `rpId`, `rpName`). See `<rules/react-native.md>`.

```typescript
const config = {
  chainId: 8453,
  apiKey: process.env.JAW_API_KEY!,
};
```

### Factory methods

#### Account.create -- new user registration

You MUST use `Account.create` for new users. It triggers WebAuthn credential creation (passkey setup). You MUST store the returned `credentialId` -- it is required to restore the account later.

```typescript
const account = await Account.create(config, { username: 'alice' });
const metadata = account.getMetadata()!;

// Store credentialId in your backend
await db.saveCredential(userId, metadata.credentialId);

console.log('Address:', account.address);
console.log('Credential ID:', metadata.credentialId);
```

#### Account.get -- returning user login

You MUST use `Account.get` with `credentialId` for returning users. This triggers WebAuthn authentication.

When called WITHOUT `credentialId`, `Account.get` attempts to restore the session silently from cached credentials (no WebAuthn prompt). When called WITH `credentialId`, it always triggers a WebAuthn authentication prompt.

```typescript
// With credentialId -- always triggers WebAuthn
const account = await Account.get(config, storedCredentialId);

// Without credentialId -- silent session restore (no WebAuthn prompt)
const account = await Account.get(config);
```

#### Account.import -- import an existing passkey account

```typescript
const account = await Account.import(config);
```

#### Account.restore -- restore from known credentials

```typescript
const account = await Account.restore(config, credentialId, publicKey);
```

#### Account.fromLocalAccount -- server-side / embedded wallets

You MUST use `Account.fromLocalAccount` for server-side operations or embedded wallet integrations where WebAuthn is not available. `getMetadata()` returns `null` for local accounts since there is no passkey.

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const localAccount = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Default — new counterfactual smart account address
const account = await Account.fromLocalAccount(config, localAccount);

// EIP-7702 — preserves the EOA address as the smart account address
const account = await Account.fromLocalAccount(config, localAccount, { eip7702: true });
// account.address === localAccount.address
```

When `{ eip7702: true }` is passed, the EOA's address is preserved via EIP-7702 delegation. The SDK handles authorization signing and owner registration automatically on the first transaction. Works with any Viem LocalAccount — private keys, Privy, Turnkey, etc. See <rules/eip7702-upgrade.md> for full details and provider examples.

### Static utility methods

```typescript
// Get address for the authenticated account (sync -- reads from localStorage)
const address = Account.getAuthenticatedAddress(apiKey);

// Get the current active account (sync)
const current = Account.getCurrentAccount(apiKey);

// List all stored accounts for this API key (sync)
const accounts = Account.getStoredAccounts(apiKey);

// Logout and clear session (sync)
Account.logout(apiKey);
```

### Instance properties

| Property | Type | Description |
|----------|------|-------------|
| `account.address` | `0x${string}` | The smart account address |
| `account.chainId` | `number` | The chain ID this account operates on |

### Instance methods

#### Transactions

```typescript
// Send a single transaction -- waits for receipt, returns tx hash
const hash = await account.sendTransaction([
  { to: '0xRecipient...', value: parseEther('0.1') },
]);

// Send batch calls -- returns immediately with user operation ID
const { id, chainId } = await account.sendCalls([
  { to: '0xAlice...', value: parseEther('0.01') },
  { to: '0xBob...', value: parseEther('0.02') },
]);

// Send calls with paymaster and permission
const { id } = await account.sendCalls(
  calls,
  { permissionId: '0x...' }, // optional permission options
  paymasterUrl,              // optional paymaster URL override
  { token: USDC_ADDRESS },   // optional paymaster context override
);

// Estimate gas for calls
const gas = await account.estimateGas([
  { to: '0xRecipient...', value: parseEther('0.1') },
]);

// Check batch call status (async -- reads from internal store, falls back to bundler RPC)
const status = await account.getCallStatus(id);
// status.status: 100=Pending, 200=Completed, 400=Failed, 500=Reverted
```

#### Signing

```typescript
// Sign a personal message
const signature = await account.signMessage('Hello World');

// Sign typed data (EIP-712)
const signature = await account.signTypedData({
  domain: { name: 'MyApp', version: '1', chainId: 8453 },
  types: { Mail: [{ name: 'content', type: 'string' }] },
  primaryType: 'Mail',
  message: { content: 'Hello' },
});
```

#### Permissions

```typescript
// Grant permissions to a spender (positional args: expiry, spender, permissions)
const result = await account.grantPermissions(
  Math.floor(Date.now() / 1000) + 86400 * 30, // expiry
  '0xSpender...', // spender address
  {
    calls: [{ target: USDC, functionSignature: 'transfer(address,uint256)' }],
    spends: [{ token: USDC, allowance: parseUnits('100', 6).toString(), unit: 'month' }],
  },
);

// Get a specific permission
const permission = await account.getPermission(permissionId);

// Revoke a permission
await account.revokePermission(permissionId);
```

#### Account metadata

```typescript
// Get passkey metadata (sync -- returns null for local accounts)
const metadata = account.getMetadata();
// { username, creationDate, isImported, credentialId }

// Get the underlying smart account instance (sync)
const smartAccount = account.getSmartAccount();

// Get the chain object (sync)
const chain = account.getChain();

// Get the address (async -- computes counterfactual address)
const address = await account.getAddress();
```

### Key rules

- You MUST use `Account.create` for new users and store the returned `credentialId` in your backend.
- You MUST use `Account.get` with `credentialId` for returning users to trigger WebAuthn authentication.
- You MUST use `Account.fromLocalAccount` for server-side operations -- it does not require WebAuthn.
- You MUST NOT call `getMetadata()` on an account created with `fromLocalAccount` and expect passkey data -- it returns `null`.
- You MUST NOT use `Account.get` without `credentialId` when you need guaranteed authentication -- it silently restores from cache and may fail if no session exists.
- You MUST NOT mix `Account` API with wagmi hooks in the same flow -- pick one approach.
- You MUST poll `await account.getCallStatus(...)` until the status leaves `100=Pending` -- the method is async and `sendCalls` returns before the transaction is mined.
- You MUST use `parseEther` or `parseUnits` from viem for value conversion -- never hardcode wei values.

### Common mistakes

Do NOT confuse `Account.get()` with and without `credentialId`:

```typescript
// Silent restore -- may fail if no cached session
const account = await Account.get(config);

// Explicit auth -- always triggers WebAuthn
const account = await Account.get(config, credentialId);
```

Do NOT use `Account.create` for returning users:

```typescript
// Wrong -- creates a duplicate account
const account = await Account.create(config, { username: 'alice' });

// Correct -- restores existing account
const account = await Account.get(config, storedCredentialId);
```

### ENS subname issuance

#### Programmatic issuance (JustaName SDK)

If using the Account class API directly instead of the wagmi connector or the provier, use `@justaname.id/sdk` with `overrideSignatureCheck: true` to bypass SIWE authentication:

```bash
npm install @justaname.id/sdk
```

```typescript
import { JustaName } from '@justaname.id/sdk';

const justaName = JustaName.init({
  networks: [{ chainId: 1, providerUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' }],
  ensDomains: [{ chainId: 1, ensDomain: 'myapp.eth', apiKey: 'your-api-key' }],
  config: { domain: 'yourdapp.com', origin: 'https://yourdapp.com' },
});

await justaName.subnames.addSubname({
  username: 'alice',
  ensDomain: 'myapp.eth',
  chainId: 1,
  overrideSignatureCheck: true,
});
```

The same API key from `dashboard.jaw.id` works for both JAW SDK and JustaName SDK — you do NOT need a separate key.

You MUST provide `ensDomains` with `apiKey` in JustaName SDK init — subname creation will fail without it.
You MUST NOT use `@jaw.id/core` for programmatic subname creation — it does not have `addSubname`.
