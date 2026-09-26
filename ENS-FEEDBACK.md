# Feedback for ENS (ENSv2 on Sepolia)

Feedback from integrating ENS as a recipient public-key directory into
ReleaseKey during ETHGlobal Tokyo 2026, for the ENS team.

## What we built

`releasekey.eth`, registered on Sepolia, holds a recipient's content-
encryption public key as a text record (`com.releasekey.encryptionPubKey`).
The agent's "prepare a record" step looks this up and encrypts the record
to it (hybrid encryption: ephemeral secp256k1 key + ECDH + HKDF +
AES-256-GCM) before anything else happens. See `web/src/lib/ens-crypto.ts`
and `web/src/lib/ens-encryption.ts`.

## Time to first success

Registering the name itself, through the official app (app.ens.domains,
Sepolia), was fast and worked first try — maybe 5 minutes end to end,
including the mandatory wait. **Writing a text record afterward took much
longer** — roughly an hour of debugging, all spent on one thing: figuring
out the resolver's actual write interface.

## The single highest-impact improvement

**Document, prominently, that Sepolia is running ENSv2 Beta contracts with
a different resolver write ABI than the classic `PublicResolver`.** We
called `setText(bytes32 node, string key, string value)` — the standard,
long-documented signature — against the resolver address our registered
name pointed to, and got `execution reverted` with **no revert data at
all**, which reads exactly like "wrong address" or "function doesn't
exist," not "wrong argument encoding." That's the worst kind of failure
to debug from the caller's side: no error message, no revert reason, just
silence.

We only found the real cause by manually reading the resolver's bytecode
on Sepolia Etherscan, discovering it's an EIP-1967 proxy, then reading its
*implementation* contract (which happened to be verified), which turned
out to be a `PermissionedResolver` with:

```
setText(bytes name, string key, string value)
```

— taking a **DNS-wire-encoded name** (`bytes`), not a `namehash` (`bytes32`).
Once we encoded the name correctly (viem's `packetToBytes` + `bytesToHex`
did it in two lines), the write went through immediately.

A single line in the docs — "ENSv2 resolvers on Sepolia take a DNS-encoded
name, not a namehash; see `packetToBytes`" — or a `require` with a revert
reason instead of a silent revert, would have turned an hour of blind
reverse-engineering into a five-minute fix.

## Other friction / missing capability or docs

- The registered ENSv2 name's resolver was **not verified on Etherscan** —
  only its underlying EIP-1967 implementation was. That's an unusual
  pattern for someone used to reading a contract's own page directly;
  finding the "Implementation" link, and realizing we needed to look
  *there* instead, wasn't obvious.
- Reads (`viem`'s `getEnsText`, `getEnsResolver`, `getEnsAddress` via the
  Sepolia `ensUniversalResolver`) worked perfectly with zero issues the
  entire time — the read path is genuinely solid and well-abstracted. The
  friction was entirely on the write side.
- The banner on app.ens.domains ("ENS v2 is coming!") and the one on the
  Sepolia contract-deployments doc page (noting periodic resets) were
  useful signals that something was different here — more detail on *what*
  is different (specifically the resolver ABI) would have saved the most
  time.
