import { fetchAllUniqueTags } from "@/app/actions";
import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

function getClientIp(request: Request): string {
  let ip: string | undefined | null;

  ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (ip) return ip;
  ip = request.headers.get("x-real-ip")?.trim();
  if (ip) return ip;
  return "127.0.0.1";
}

export async function GET(request: Request) {
  const clientIp = getClientIp(request);

  try {
    await rateLimiter.consume(clientIp);
  } catch (rateLimiterRes) {
    return NextResponse.json({ message: "Too Many Requests" }, { status: 429 });
  }

  try {
    const tags = await fetchAllUniqueTags();
    return NextResponse.json(tags);
  } catch (error) {
    console.error("[API /api/tags] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { message: `Internal Server Error: ${message}` },
      { status: 500 }
    );
  }
}
