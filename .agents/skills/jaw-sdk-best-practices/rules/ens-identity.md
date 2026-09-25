## ENS Identity

Subname profile management — update records, resolve ENS names to profiles, and reverse-resolve addresses to ENS names using `@justaname.id/sdk`.

> For subname issuance if using the Account class API you can do it programmatically check the **Account API**, however, when using the wagmi connector or the EIP 1193 provider it is done automatically under the hood check the **Configuration**.

```bash
npm install @justaname.id/sdk
```

### Update

Use `updateSubname()` to update text records and coin addresses on an existing subname. Requires SIWE authentication.

```typescript
import { JustaName } from '@justaname.id/sdk';

const justaName = JustaName.init({
  networks: [{ chainId: 1, providerUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' }],
  ensDomains: [{ chainId: 1, ensDomain: 'myapp.eth', apiKey: 'your-api-key' }],
  config: { domain: 'yourdapp.com', origin: 'https://yourdapp.com' },
});

await justaName.subnames.updateSubname(
  {
    username: 'alice',
    ensDomain: 'myapp.eth',
    chainId: 1,
    text: [
      { key: 'avatar', value: 'https://myapp.com/avatar.png' },
      { key: 'description', value: 'Updated bio' },
    ],
  },
  { xMessage: challenge, xAddress: address, xSignature: signature }
);
```

### Resolve

Use `getRecords()` to fetch a subname's text records and coin addresses. Only `networks` is required — no `ensDomains` or `apiKey` needed for read-only resolution.

```typescript
import { JustaName } from '@justaname.id/sdk';

const justaName = JustaName.init({
  networks: [{ chainId: 1, providerUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' }],
});

const profile = await justaName.subnames.getRecords({
  ens: 'alice.myapp.eth',
});

console.log(profile.records.texts);  // [{ key: 'avatar', value: '...' }, ...]
console.log(profile.records.coins);  // [{ id: 60, name: 'ETH', value: '0x...' }]
```

### Reverse resolve

Use `reverseResolve()` to look up the ENS name for an address. Returns `string | null`.

```typescript
const ensName = await justaName.subnames.reverseResolve({
  address: '0x1234...abcd',
  chainId: 1,
});

console.log(ensName); // 'alice.myapp.eth'
```

### Key rules

- You MUST install `@justaname.id/sdk` separately — it is NOT included in `@jaw.id/core` or `@jaw.id/wagmi`.
- You MUST provide `ensDomains` with `apiKey` when updating subnames — resolution-only use cases (`getRecords`, `reverseResolve`) only need `networks`.
- `reverseResolve` returns `string | null` directly — NOT an object with an `ens` property.
- You MUST NOT call `getRecords` or `reverseResolve` on `@jaw.id/core` — they only exist on `@justaname.id/sdk`.

### Common mistakes

Do NOT use the JAW SDK for profile resolution:

```typescript
// Wrong -- getRecords is not on the JAW SDK
import { JAW } from '@jaw.id/core';
const jaw = JAW.create({ apiKey: 'key' });
jaw.getRecords({ ens: 'alice.myapp.eth' }); // Does not exist

// Correct -- use @justaname.id/sdk for resolution
import { JustaName } from '@justaname.id/sdk';
const justaName = JustaName.init({ networks: [{ chainId: 1, providerUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' }] });
const profile = await justaName.subnames.getRecords({ ens: 'alice.myapp.eth' });
```

Do NOT initialize JustaName SDK without `ensDomains` when updating subnames:

```typescript
// Wrong -- missing ensDomains, update will fail
const justaName = JustaName.init({
  networks: [{ chainId: 1, providerUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' }],
});
await justaName.subnames.updateSubname(...); // Fails

// Correct -- include ensDomains with apiKey for updates
const justaName = JustaName.init({
  networks: [{ chainId: 1, providerUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' }],
  ensDomains: [{ chainId: 1, ensDomain: 'myapp.eth', apiKey: 'your-api-key' }],
  config: { domain: 'yourdapp.com', origin: 'https://yourdapp.com' },
});
```
