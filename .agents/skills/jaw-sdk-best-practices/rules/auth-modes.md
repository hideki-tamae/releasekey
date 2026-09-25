## Authentication Modes

Two modes determine where passkey operations occur: **CrossPlatform** and **AppSpecific**.

### Mode Comparison


| Feature            | CrossPlatform (Default)  | AppSpecific         |
| ------------------ | ------------------------ | ------------------- |
| Passkey operations | On `keys.jaw.id` (popup) | Within your dApp    |
| User experience    | Redirects to popup       | Stays in your app   |
| Wallet reuse       | Universal across apps    | App-specific only   |
| Branding           | JAW interface            | Custom UI supported |
| Setup complexity   | None (default)           | Requires uiHandler  |


### Use CrossPlatform (default) when:

- Users should reuse their wallet across multiple dApps.
- You want quick integration with zero UI work.
- A consistent, maintained auth UI is acceptable.

### Use AppSpecific when:

- Users must stay entirely within your application.
- You need full control over the UI/UX.
- You are building a white-label experience.
- Wallet portability across apps is not needed.

### CrossPlatform Setup (Default)

```typescript
import { jaw } from '@jaw.id/wagmi';
import { Mode } from '@jaw.id/core';

// CrossPlatform is default — no preference needed
const connector = jaw({ apiKey: 'your-api-key' });

// Or explicitly:
const connector = jaw({
  apiKey: 'your-api-key',
  preference: { mode: Mode.CrossPlatform },
});
```

### AppSpecific Setup

```typescript
import { jaw } from '@jaw.id/wagmi';
import { Mode } from '@jaw.id/core';
import { ReactUIHandler } from '@jaw.id/ui';

const connector = jaw({
  apiKey: 'your-api-key',
  preference: {
    mode: Mode.AppSpecific,
    uiHandler: new ReactUIHandler(),
  },
});
```

### Core Provider — AppSpecific

```typescript
import { JAW, Mode } from '@jaw.id/core';
import { ReactUIHandler } from '@jaw.id/ui';

const jaw = JAW.create({
  apiKey: 'your-api-key',
  preference: {
    mode: Mode.AppSpecific,
    uiHandler: new ReactUIHandler(),
  },
});
```

### Key Rules

- You MUST provide a `uiHandler` when using `Mode.AppSpecific` — the SDK will throw without one.
- You CAN use ReactUIHandler from @jaw.id/ui as a pre-built solution, OR implement the UIHandler interface yourself.
- You MUST NOT switch modes after initialization — mode is set once at creation.
- Use `Mode.CrossPlatform` (default) unless you have a specific reason for AppSpecific.
- Import `Mode` from `@jaw.id/core`, not from `@jaw.id/wagmi`.

### Common Mistakes

Do NOT use AppSpecific without a uiHandler:

```typescript
// Wrong — will throw
jaw({
  apiKey: 'key',
  preference: { mode: Mode.AppSpecific },
});
```

Instead:

```typescript
// Correct
import { ReactUIHandler } from '@jaw.id/ui';

jaw({
  apiKey: 'key',
  preference: {
    mode: Mode.AppSpecific,
    uiHandler: new ReactUIHandler(),
  },
});
```

