import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proof, action, signal } = body;
    
    // SPEC §6: サーバーサイドでAPIを叩いて検証する
    const appId = process.env.NEXT_PUBLIC_WLD_APP_ID; 
    const verifyRes = await fetch(`https://developer.worldcoin.org/api/v1/verify/${appId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...proof, action, signal }), 
    });

    const wldResponse = await verifyRes.json();

    if (verifyRes.ok) {
      // 成功時: SPEC §5, §6に基づき、ここでコントラクトの approveRelease を呼ぶ
      console.log("World ID verification successful", wldResponse);
      return NextResponse.json({ success: true, verificationRef: wldResponse.nullifier_hash });
    } else {
      // 失敗パス: 拒否やエラー
      console.se, error: wldResponse }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Server error during verification:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
