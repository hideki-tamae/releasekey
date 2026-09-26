import { NextRequest, NextResponse } from "next/server";
import { isHex } from "viem";
import { buildAuthorizeUrl, createAuthRequestSecrets } from "@/lib/world-oidc";
import { pendingReleaseStore } from "@/lib/pending-release-store";

// GET /api/world/authorize?recordId=0x...
// Starts a brand-new World ID for Agents verification, bound to a single
// recordId. Redirects the user's browser to World ID; they come back at
// /api/world/callback. Never approves anything itself.
export async function GET(req: NextRequest) {
  const recordId = req.nextUrl.searchParams.get("recordId");

  if (!recordId || !isHex(recordId, { strict: true }) || recordId.length !== 66) {
    return NextResponse.json({ error: "invalid_record_id" }, { status: 400 });
  }

  const { codeVerifier, codeChallenge, state, nonce } = createAuthRequestSecrets();

  pendingReleaseStore.create(state, { recordId, codeVerifier, nonce });

  const authorizeUrl = buildAuthorizeUrl({ state, nonce, codeChallenge });

  return NextResponse.redirect(authorizeUrl);
}
