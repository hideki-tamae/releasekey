import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForIdToken, verifyWorldIdToken, WorldVerificationError } from "@/lib/world-oidc";
import { pendingReleaseStore } from "@/lib/pending-release-store";
import { resolvePendingRelease, buildVerificationRef, RELEASE_TTL_SECONDS, ReleaseFlowError } from "@/lib/release-flow";
import { approveRelease } from "@/lib/chain";

// GET /api/world/callback — World ID redirects here after the user
// approves, denies, or the request expires/errors.
//
// Failure-path contract (SPEC.md §6): on ANY problem — denied, cancelled,
// expired, tampered, replayed, or a recordId mismatch — there must be NO
// on-chain approveRelease call and NO release envelope. We only reach the
// approveRelease() call at the very bottom of the try block, after every
// check above it has passed.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const state = searchParams.get("state");

  const failure = (reason: string, recordId?: string) =>
    NextResponse.redirect(
      new URL(
        `/release/result?status=denied&reason=${encodeURIComponent(reason)}${
          recordId ? `&recordId=${recordId}` : ""
        }`,
        req.nextUrl.origin
      )
    );

  // World ID itself reports a problem (user denied, cancelled, expired
  // request, etc.) — stop immediately, never attempt a token exchange.
  const oidcError = searchParams.get("error");
  if (oidcError) {
    return failure(oidcError);
  }

  const code = searchParams.get("code");
  if (!code) {
    return failure("missing_code");
  }

  try {
    const pending = resolvePendingRelease(pendingReleaseStore, state);

    const idToken = await exchangeCodeForIdToken(code, pending.codeVerifier);
    const claims = await verifyWorldIdToken(idToken, pending.nonce);

    const verificationRef = buildVerificationRef(pending.recordId, claims);

    await approveRelease({
      recordId: pending.recordId,
      verificationRef,
      ttlSeconds: RELEASE_TTL_SECONDS,
    });

    return NextResponse.redirect(
      new URL(`/release/result?status=approved&recordId=${pending.recordId}`, req.nextUrl.origin)
    );
  } catch (err) {
    if (err instanceof ReleaseFlowError) {
      return failure(err.reason);
    }
    if (err instanceof WorldVerificationError) {
      return failure(`verification_failed: ${err.message}`);
    }
    console.error("Unexpected error in World ID callback:", err);
    return failure("internal_error");
  }
}
