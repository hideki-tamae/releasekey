## TypeScript Types

Key TypeScript interfaces and types used across the JAW SDK. All types are exported from `@jaw.id/core`.

### AccountConfig

Configuration for all `Account` factory methods:

```typescript
interface AccountConfig {
  chainId: number;
  apiKey: string;
  paymasterUrl?: string;
  paymasterContext?: Record<string, unknown>;
}
```

### CreateAccountOptions

Options for `Account.create`:

```typescript
interface CreateAccountOptions {
  username: string;
  rpId?: string;    // Relying party ID for WebAuthn (defaults to current domain)
  rpName?: string;  // Relying party name shown in passkey prompt
}
```

### TransactionCall

A single call in a batch transaction:

```typescript
import type { Address, Hex } from 'viem';

interface TransactionCall {
  to: Address;             // Target contract or recipient address
  value?: bigint | string; // ETH value in wei (bigint or hex string)
  data?: Hex;              // Encoded calldata
}
```

### AccountMetadata

Metadata returned by `account.getMetadata()`:

```typescript
interface AccountMetadata {
  username: string;
  creationDate: string;    // ISO 8601 datetime
  isImported: boolean;
  credentialId: string;    // WebAuthn credential ID
}
```

### PasskeyAccount

Stored account entry returned by `Account.getStoredAccounts`:

```typescript
interface PasskeyAccount {
  creationDate: string;
  credentialId: string;
  isImported: boolean;
  username: string;
  publicKey: `0x${string}`;
}
```

### BundledTransactionResult

Returned by `account.sendCalls()`:

```typescript
import type { Hash } from 'viem';

type BundledTransactionResult = {
  id: Hash;        // User operation ID
  chainId: number; // Chain the operation was submitted to
}
```

### CallStatusResponse

Returned by `account.getCallStatus()`:

```typescript
interface CallStatusResponse {
  version: string;
  id: Hex;
  chainId: Hex;           // Hex string (e.g., '0x2105' for Base)
  status: number;         // 100=Pending, 200=Completed, 400=Failed, 500=Reverted
  atomic: boolean;        // Whether the batch was atomic
  receipts?: {
    logs: { address: Address; topics: Hex[]; data: Hex }[];
    status: Hex;          // '0x1' for success
    blockHash: Hex;
    blockNumber: Hex;
    gasUsed: Hex;
    transactionHash: Hex;
  }[];
}
```

### PermissionsDetail

Structure for permission grants:

```typescript
interface PermissionsDetail {
  calls?: CallPermissionDetail[];
  spends?: SpendPermissionDetail[];
}
```

### CallPermissionDetail

Defines which contract functions a spender can call:

```typescript
interface CallPermissionDetail {
  target: Address;               // Contract address
  selector?: Hex;                // 4-byte function selector (e.g., '0xa9059cbb')
  functionSignature?: string;    // Human-readable signature (e.g., 'transfer(address,uint256)')
}
```

You MUST provide either `selector` or `functionSignature` -- not both. The SDK computes the selector from `functionSignature` automatically.

### SpendPermissionDetail

Defines token spending limits per time period:

```typescript
interface SpendPermissionDetail {
  token: Address;         // Token contract address (or ERC-7528 native token address)
  allowance: string;      // Maximum amount per period (in token's smallest unit, as string)
  unit: SpendPeriod;      // Time period
  multiplier?: number;    // Period multiplier (1-255). E.g., unit:'week', multiplier:2 = every 2 weeks
}
```

### SpendPeriod

Valid time periods for spending limits:

```typescript
type SpendPeriod = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'forever';
```

### WalletGrantPermissionsResponse

Returned by `grantPermissions`:

```typescript
interface WalletGrantPermissionsResponse {
  account: Address;       // Smart account address
  spender: Address;       // Authorized spender address
  start: number;          // Permission start time (Unix timestamp in seconds)
  end: number;            // Permission end time (Unix timestamp in seconds)
  salt: Hex;              // Unique salt for this permission
  calls: CallPermissionDetail[];
  spends: SpendPermissionDetail[];
  permissionId: Hex;      // Unique permission identifier -- store this
  chainId: Hex;           // Chain where permission is active (hex string)
}
```

### UIHandler types

```typescript
interface UIHandler {
  init?(config: UIHandlerConfig): void;
  request<T>(request: UIRequest): Promise<UIResponse<T>>;
  canHandle?(request: UIRequest): boolean;
  cleanup?(): Promise<void>;
}

interface UIHandlerConfig {
  apiKey: string;
  defaultChainId?: number;
  paymasters?: Record<number, { url: string; context?: Record<string, unknown> }>;
  appName?: string;
  appLogoUrl?: string | null;
  ens?: string;
  showTestnets?: boolean;
}

interface UIRequest {
  id: string;
  type: string;          // e.g., 'wallet_connect', 'personal_sign', 'wallet_sendCalls'
  data?: unknown;        // Request-specific data (shape depends on type)
  timestamp: number;
  correlationId?: string;
}

interface UIResponse<T> {
  id: string;            // MUST match request.id
  approved: boolean;
  data?: T;
  error?: UIError;
}
```

### Key rules

- All addresses are `0x${string}` hex format (viem's `Address` type). You MUST NOT pass addresses without the `0x` prefix.
- All ETH/token values are in wei. You MUST use `parseEther()` or `parseUnits()` from viem for conversion -- never manually compute wei values.
- All timestamps are in **seconds** (Unix epoch), not milliseconds. You MUST use `Math.floor(Date.now() / 1000)` when computing timestamps from JavaScript's millisecond-based `Date.now()`.
- The `allowance` field in `SpendPermissionDetail` is a `string`, not a `bigint`. You MUST call `.toString()` on `parseUnits()` results.
- You MUST use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (ERC-7528) as the token address for native ETH in spend permissions -- not the zero address.
- You MUST store the `permissionId` from `WalletGrantPermissionsResponse` -- it is required for delegated execution and revocation.
- You MUST match `request.id` in every `UIResponse` -- mismatched IDs cause the SDK to hang.
