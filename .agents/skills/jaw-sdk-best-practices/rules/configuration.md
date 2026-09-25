## Configuration

All configuration options for the JAW SDK, applicable to both wagmi connector and direct provider.

### Core parameters


| Parameter        | Type                                                                 | Required | Description                                         |
| ---------------- | -------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `apiKey`         | `string`                                                             | Yes      | API key from dashboard.jaw.id                       |
| `appName`        | `string`                                                             | No       | App name shown in auth UI (default: 'DApp')         |
| `appLogoUrl`     | `string                                                              | null`    | No                                                  |
| `ens`            | `string`                                                             | No       | ENS domain for subname issuance (e.g., 'myapp.eth') |
| `defaultChainId` | `number`                                                             | No       | Default chain (default: 1 = Ethereum Mainnet)       |
| `paymasters`     | `Record<number, { url: string; context?: Record<string, unknown> }>` | No       | Paymaster config per chain for gas sponsoring       |


### Preference options


| Option         | Type                | Default           | Description                                                     |
| -------------- | ------------------- | ----------------- | --------------------------------------------------------------- |
| `mode`         | `Mode.CrossPlatform | Mode.AppSpecific` | `Mode.CrossPlatform`                                            |
| `uiHandler`    | `UIHandler`         | `undefined`       | Required for AppSpecific mode                                   |
| `showTestnets` | `boolean`           | `false`           | Show testnet networks                                           |
| `authTTL`      | `number`            | `86400`           | Session cache TTL in seconds (0 = require auth every page load) |


### Transport: embedded dialog and the Safari/Firefox allow-list

The CrossPlatform dialog is embedded as an iframe by default and needs **no configuration** -- do NOT add transport setup code or a `transportMode` option to "fix" browser behavior. On **Safari and Firefox** it automatically falls back to a popup on untrusted hosts (a browser clickjacking limitation, not a bug); to get the embedded dialog on those browsers, the dApp's domain must be added to JAW's trusted allow-list. Tell the developer to reach out on [Telegram](https://t.me/+RsFLPfky7-YxZjVk) to be added. Chromium-based browsers (Chrome, Edge, Brave) work with no setup.


### Correct wagmi configuration

```typescript
import { createConfig, http } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { jaw } from '@jaw.id/wagmi';

export const config = createConfig({
  chains: [mainnet, base],
  connectors: [
    jaw({
      apiKey: 'your-api-key',
      appName: 'My DApp',
      appLogoUrl: 'https://my-dapp.com/logo.png',
      defaultChainId: 8453,
      ens: 'myapp.eth',
      preference: {
        showTestnets: false,
      },
      paymasters: {
        8453: { url: 'https://paymaster.example.com/rpc?apikey=YOUR_KEY' },
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});
```

### Correct core provider configuration

```typescript
import { JAW } from '@jaw.id/core';

const jaw = JAW.create({
  apiKey: 'your-api-key',
  appName: 'My DApp',
  appLogoUrl: 'https://my-dapp.com/logo.png',
  defaultChainId: 8453,
});
```

### Minimal configuration

The only required option is `apiKey`:

```typescript
// Wagmi
const connector = jaw({ apiKey: 'your-api-key' });

// Core provider
const jaw = JAW.create({ apiKey: 'your-api-key' });
```

### Key rules

- You MUST provide `apiKey` -- it is the only required configuration option.
- You MUST configure allowed domains in the JAW Dashboard for your API key.
- if you provide `appLogoUrl`, it MUST set to an HTTPS URL with a minimum 200x200px square image.
- You MUST enable `preference.showTestnets: true` when using a testnet `defaultChainId`.
- You MUST provide a `uiHandler` when using `Mode.AppSpecific`.
- You MUST NOT store the API key in client-side code in production -- use environment variables.
- Do NOT add more configuration than needed -- start minimal and add features incrementally.

### Common mistakes

Do NOT use a testnet chain ID without enabling testnets:

```typescript
// Wrong -- testnet chain won't be available
jaw({ apiKey: 'key', defaultChainId: 84532 })
```

Instead:

```typescript
// Correct
jaw({
  apiKey: 'key',
  defaultChainId: 84532,
  preference: { showTestnets: true },
})
```

