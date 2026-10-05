# Feedback from ETHGlobal Tokyo 2026 → v2 changes

Source of the feedback that drives Phase 1.5 (see [`SPEC-v2.md`](../../SPEC-v2.md) §3). Recorded so the reason for each change can be traced back to what a judge or mentor actually said.

| Who | Feedback | Where it lands in v2 |
|---|---|---|
| Judge (summary) | 「医師を地域と評価で探せるとよい」 — doctors should be findable by region and rating | Phase 1.5, part 1: doctor discovery (`/doctors`, `web/src/lib/doctor-search.ts`). Location is coarse (prefecture / city only); ratings are synthetic demo values. |
| Judge (summary) | 「フォローアップ後も非同期のスレッドで記録が続くとよい」 — after a follow-up, records should continue in an asynchronous thread | Phase 1.5, part 2: follow-up threads. Each share in a thread is a new record and needs a fresh human approval. Implemented as `/api/threads` and `/thread/:id`. |
| Mentor Leo (verbatim) | "I think doctor , then follow up" | Ordering: doctor discovery is built first, follow-up second. |

Summaries above are paraphrased from the judging conversation, except where marked verbatim.
