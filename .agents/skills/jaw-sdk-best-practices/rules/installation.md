## Installation

Package installation, peer dependencies, and choosing between wagmi and core.

### Choosing your integration path

| Package | Use Case | Install Command |
|---------|----------|----------------|
| `@jaw.id/wagmi` | React/Next.js apps using wagmi | `npm install @jaw.id/wagmi wagmi viem @tanstack/react-query` |
| `@jaw.id/core` | Non-React, vanilla JS, server-side, headless | `npm install @jaw.id/core viem` |
| `@jaw.id/ui` | App-specific mode with pre-built React UI | `npm install @jaw.id/ui` (add-on to core or wagmi) |
| `@jaw.id/core` + RN adapters | React Native (Expo bare workflow) | `npm install @jaw.id/core viem react-native-passkey react-native-quick-crypto react-native-nitro-modules react-native-mmkv` -- see `<rules/react-native.md>` |

### Correct installation

For React/Next.js apps (recommended):
```bash
npm install @jaw.id/wagmi wagmi viem @tanstack/react-query
```

For vanilla JS / server-side / headless:
```bash
npm install @jaw.id/core viem
```

For app-specific mode with React UI:
```bash
npm install @jaw.id/wagmi @jaw.id/ui @jaw.id/core
```

### Key rules

- You MUST install `viem` as a peer dependency -- it is required by all JAW packages.
- You MUST install `wagmi` and `@tanstack/react-query` when using `@jaw.id/wagmi`.
- You MUST obtain an API key from https://dashboard.jaw.id before using any JAW package.
- You MUST configure allowed domains in the JAW Dashboard for your API key (localhost for dev, your domain for production).
- You MUST NOT use `@jaw.id/ui` without `@jaw.id/core` -- it depends on core.
- You MUST use `@jaw.id/core` (not `@jaw.id/wagmi` or `@jaw.id/ui`) on React Native -- see `<rules/react-native.md>`.
- Do NOT mix provider-based and Account-based approaches in the same flow -- pick one pattern.

### Common mistakes

Do NOT install only `@jaw.id/wagmi` without peer dependencies:
```bash
# Wrong -- missing peer deps
npm install @jaw.id/wagmi
```

Instead, install all required packages:
```bash
# Correct
npm install @jaw.id/wagmi wagmi viem @tanstack/react-query
```
