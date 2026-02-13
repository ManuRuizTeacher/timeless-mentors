import { NextResponse } from "next/server";

const SIMLI_API_KEY = process.env.SIMLI_API_KEY;

export async function GET() {
  if (!SIMLI_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const res = await fetch("https://api.simli.ai/agents", {
    headers: { "x-simli-api-key": SIMLI_API_KEY },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Simli error" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
