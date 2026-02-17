import { NextRequest, NextResponse } from "next/server";

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

export async function POST(req: NextRequest) {
  if (!SIMLI_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { agentId, faceId, voiceId, voiceModel, ttsProvider, language, systemPrompt, firstMessage, maxSessionLength, maxIdleTime } = body;

    if (!faceId) {
      return NextResponse.json(
        { error: "Missing faceId" },
        { status: 400 }
      );
    }

    const res = await fetch(
      "https://api.simli.ai/auto/start/configurable",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-simli-api-key": SIMLI_API_KEY,
        },
        body: JSON.stringify({
          faceId,
          ttsProvider: ttsProvider || "Cartesia",
          voiceId: voiceId || undefined,
          ttsModel: voiceModel || undefined,
          language: language || "en",
          systemPrompt: systemPrompt || undefined,
          firstMessage: firstMessage || undefined,
          maxSessionLength: maxSessionLength || 3600,
          maxIdleTime: maxIdleTime || 300,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || "Simli start error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
