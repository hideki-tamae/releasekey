## React Native (Expo bare workflow)

`@jaw.id/core` runs on React Native via a passkey adapter that delegates WebAuthn to the platform's native APIs through [`react-native-passkey`](https://github.com/f-23/react-native-passkey). Use this rule when building Expo bare workflow apps with passkey-authenticated smart accounts.

### When to use

| Scenario | RN supported? |
|----------|--------------|
| Expo bare workflow (custom dev client) | Yes |
| `npx expo run:ios` / `expo run:android` | Yes |
| EAS dev/preview/production builds | Yes |
| Expo Go | NO -- `react-native-passkey` and `react-native-quick-crypto` are NitroModules and require native code |
| React Native CLI projects | Yes |

### Install

You MUST install `@jaw.id/core` plus the native peer dependencies:

```bash
npm install @jaw.id/core viem \
  react-native-passkey \
  react-native-quick-crypto \
  react-native-nitro-modules \
  react-native-mmkv
```

| Package | Why |
|---------|-----|
| `@jaw.id/core` | The SDK |
| `viem` | Required peer dep |
| `react-native-passkey` | Native iOS / Android passkey APIs |
| `react-native-quick-crypto` | Polyfills `crypto.getRandomValues`, `crypto.subtle` (required by `viem` and `ox`) |
| `react-native-nitro-modules` | Required by `react-native-quick-crypto` |
| `react-native-mmkv` | Fast synchronous key-value storage (passkey persistence) |

### Crypto polyfill

You MUST install the crypto polyfill at the entry point BEFORE any JAW or viem import:

```javascript
// index.js (set as "main" in package.json)
import { install } from 'react-native-quick-crypto';
install();

import 'expo-router/entry';
```

```json
// package.json
{
  "main": "index.js"
}
```

### Native config

Passkeys require platform-level domain association. You MUST host both the iOS AASA file AND the Android Digital Asset Links file at the same domain you use as `rpId`.

#### iOS -- Associated Domains

In `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourorg.yourapp",
      "associatedDomains": ["webcredentials:yourdomain.com"]
    }
  }
}
```

For free Apple Developer accounts ("Personal Team"), append `?mode=developer`:

```json
"associatedDomains": ["webcredentials:yourdomain.com?mode=developer"]
```

Host the AASA file at `https://yourdomain.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": { "apps": [], "details": [] },
  "webcredentials": {
    "apps": ["TEAMID.com.yourorg.yourapp"]
  }
}
```

It MUST be served as `Content-Type: application/json` over HTTPS.

#### Android -- Digital Asset Links

Host `assetlinks.json` at `https://yourdomain.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourorg.yourapp",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:..."
      ]
    }
  }
]
```

You MUST register the SHA-256 fingerprint of the keystore that signs the build. For team development, commit a single shared `android/app/debug.keystore` so every teammate produces the same fingerprint.

#### Rebuild after wiring

```bash
npx expo prebuild --clean
npx expo run:ios     # or run:android
```

You MUST rerun `prebuild --clean` whenever `app.json` ios/android config or native dependencies change. JS-only SDK changes do NOT need prebuild -- `npx expo start --clear` is enough.

### AccountConfig -- RN fields

```typescript
import type {
  NativePasskeyGetFn,
  NativePasskeyCreateFn,
  SyncStorage,
} from '@jaw.id/core';

interface AccountConfig {
  chainId: number;
  apiKey: string;
  paymasterUrl?: string;
  paymasterContext?: Record<string, unknown>;

  // React Native fields
  storage?: SyncStorage;                  // MUST provide for persistence
  nativeGetFn?: NativePasskeyGetFn;       // MUST set -- Passkey.get
  nativeCreateFn?: NativePasskeyCreateFn; // MUST set for Account.create -- Passkey.create
  rpId?: string;                          // MUST set -- explicit hostname
  rpName?: string;                        // Display name in passkey prompt
}
```

### SyncStorage backed by MMKV

You MUST supply a persistent `SyncStorage`. The default in-memory fallback wipes on app restart, losing all passkeys.

```typescript
import { MMKV } from 'react-native-mmkv';
import type { SyncStorage } from '@jaw.id/core';

const mmkv = new MMKV({ id: 'jaw-sdk' });

// SyncStorage.setItem receives `unknown`; MMKV only stores primitives, so
// serialize on write and parse on read -- mirrors the SDK's own
// createLocalStorage adapter.
export const storage: SyncStorage = {
  getItem: <T>(key: string): T | null => {
    const value = mmkv.getString(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },
  setItem: (key: string, value: unknown): void => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    mmkv.set(key, serialized);
  },
  removeItem: (key: string): void => {
    mmkv.delete(key);
  },
};
```

### Wiring example

Centralize RN config so every factory call gets the same options:

```typescript
import { Passkey } from 'react-native-passkey';
import type { AccountConfig } from '@jaw.id/core';
import { storage } from './storage';

export function buildConfig(): AccountConfig {
  return {
    chainId: 8453,
    apiKey: process.env.EXPO_PUBLIC_JAW_API_KEY!,
    storage,
    nativeGetFn: Passkey.get,
    nativeCreateFn: Passkey.create,
    rpId: 'yourdomain.com',
    rpName: 'Your App',
  };
}
```

### Recipes

#### New user -- Account.create

```typescript
import { Account } from '@jaw.id/core';

const account = await Account.create(buildConfig(), { username: 'alice' });
const { credentialId } = account.getMetadata()!;
// Persist credentialId for future logins
```

#### Returning user -- Account.get with credentialId

```typescript
const config = buildConfig();
const stored = Account.getStoredAccounts(config.apiKey, config.storage);
const account = await Account.get(config, stored[0].credentialId);
```

#### Silent restore -- Account.get without credentialId

```typescript
// No native passkey prompt -- restores from storage if a session exists
const account = await Account.get(buildConfig());
```

#### Restore from session data -- Account.restore

```typescript
const account = await Account.restore(
  buildConfig(),
  session.credentialId,
  session.publicKey,
);
// Signing operations later trigger nativeGetFn
const sig = await account.signMessage('Hello');
```

#### Import from cloud (iCloud Keychain / Google Password Manager)

```typescript
const account = await Account.import(buildConfig());
```

### Key rules

- You MUST pass `nativeGetFn` (and `nativeCreateFn` for `Account.create`) in `AccountConfig` -- `navigator.credentials` does not exist on React Native.
- You MUST set an explicit `rpId` -- there is no `window.location.hostname` to fall back on.
- You MUST host both `apple-app-site-association` (iOS) and `assetlinks.json` (Android) at the domain used as `rpId`, with the matching Team ID / package fingerprint.
- You MUST provide a persistent `SyncStorage` (MMKV or similar). The default in-memory fallback loses all passkeys on app restart.
- You MUST poll `await account.getCallStatus(...)` until the status leaves `100=Pending` -- the method is async and `sendCalls` returns before the transaction is mined.
- You MUST install the crypto polyfill (`install()` from `react-native-quick-crypto`) at the JS entry point before any JAW import -- viem and ox depend on `crypto.getRandomValues` and `crypto.subtle`.
- You MUST rebuild with `prebuild --clean` after changing native deps or `app.json` ios/android config. JS-only SDK updates only need `expo start --clear`.
- You MUST NOT use Expo Go -- `react-native-passkey` and `react-native-quick-crypto` are NitroModules and need a custom dev client.
- You MUST NOT install `@jaw.id/wagmi` or `@jaw.id/ui` in a React Native project -- they target browser DOM and React DOM. Use `@jaw.id/core` directly with a custom UI.
- You MUST NOT mix `Passkey.get` from one library with `nativeCreateFn` from another -- the credential format expectations diverge.

### Common mistakes

#### Per-developer keystores break Android passkeys

Each Android dev signs the debug build with their own `~/.android/debug.keystore` by default, so every teammate has a different SHA-256 fingerprint. Only the fingerprint registered in `assetlinks.json` works; everyone else's build silently fails the platform check.

```gradle
// Wrong -- relies on each dev's local keystore
android {
  signingConfigs {
    debug { /* uses ~/.android/debug.keystore */ }
  }
}
```

```gradle
// Correct -- commit one shared debug.keystore in the repo
android {
  signingConfigs {
    debug {
      storeFile file('debug.keystore')   // committed at android/app/debug.keystore
      storePassword 'android'
      keyAlias 'androiddebugkey'
      keyPassword 'android'
    }
  }
}
```

Then register that one keystore's SHA-256 in `assetlinks.json`.

#### `rpId` must match the AASA / assetlinks host

```typescript
// Wrong -- passkeys won't bind to a real domain, AASA can't be hosted at localhost
const config = {
  chainId: 8453,
  apiKey,
  nativeGetFn: Passkey.get,
  rpId: 'localhost',
};
```

```typescript
// Correct -- hostname matches webcredentials in associatedDomains and the AASA file location
const config = {
  chainId: 8453,
  apiKey,
  nativeGetFn: Passkey.get,
  rpId: 'yourdomain.com',
};
```

#### In-memory storage loses passkeys on restart

```typescript
// Wrong -- no storage provided, falls back to in-memory map; restart wipes it
const config = {
  chainId: 8453,
  apiKey,
  nativeGetFn: Passkey.get,
  rpId: 'yourdomain.com',
};
```

```typescript
// Correct -- MMKV-backed SyncStorage persists across launches
const config = {
  chainId: 8453,
  apiKey,
  storage,                   // SyncStorage backed by MMKV
  nativeGetFn: Passkey.get,
  rpId: 'yourdomain.com',
};
```

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `NitroModules are not supported in Expo Go` | Running in Expo Go | Use `expo run:ios/android` to build a dev client |
| `Property 'crypto' doesn't exist` | Polyfill not installed at entry | Add `install()` from `react-native-quick-crypto` in `index.js` |
| Passkey prompt appears, no credentials returned (iOS) | AASA missing or wrong Team ID | Verify `curl https://<rpId>/.well-known/apple-app-site-association` returns valid JSON with your Team ID |
| Android passkey call fails silently | `assetlinks.json` missing or wrong SHA-256 | Verify `curl https://<rpId>/.well-known/assetlinks.json` returns the build's keystore fingerprint |
| `getCallStatus` returns 400 (offchain failure) | Background receipt poller couldn't resolve a bundler client | Upgrade `@jaw.id/core` to the latest version |
| `Account.create` succeeds but smart account deployment fails (`AA13 initCode failed`) | Public key extracted at wrong length (65 vs 64 bytes) | Upgrade `@jaw.id/core` to the latest version |
