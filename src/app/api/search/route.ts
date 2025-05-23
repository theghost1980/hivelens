import { searchLocalImages } from "@/app/actions"; // Tu Server Action
import type { SearchFiltersDb } from "@/lib/database";
import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

// Configuración del Rate Limiter (ejemplo: 100 peticiones por minuto por IP)
const rateLimiter = new RateLimiterMemory({
  points: 10, // Número de puntos
  duration: 60, // Por segundo
});

function getClientIp(request: Request): string {
  let ip: string | undefined | null;

  ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (ip) return ip;

  ip = request.headers.get("x-real-ip")?.trim();
  if (ip) return ip;

  // Para entornos locales o si no se encuentran los headers anteriores.
  // En Node.js runtime con `NextApiRequest`, `req.socket.remoteAddress` podría usarse,
  // pero no está disponible en el objeto `Request` estándar del Edge Runtime.
  return "127.0.0.1"; // Fallback
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const clientIp = getClientIp(request);
  try {
    await rateLimiter.consume(clientIp); // Consume 1 punto por petición
  } catch (rateLimiterRes) {
    // Si se excede el límite
    return NextResponse.json({ message: "Too Many Requests" }, { status: 429 });
  }

  try {
    const filters: SearchFiltersDb = {};
    if (searchParams.has("searchTerm"))
      filters.searchTerm = searchParams.get("searchTerm")!;
    if (searchParams.has("author"))
      filters.author = searchParams.get("author")!;
    if (searchParams.has("title")) filters.title = searchParams.get("title")!;
    if (searchParams.has("tags")) filters.tags = searchParams.get("tags")!;
    if (searchParams.has("dateFrom"))
      filters.dateFrom = searchParams.get("dateFrom")!;
    if (searchParams.has("dateTo"))
      filters.dateTo = searchParams.get("dateTo")!;

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { message: "Invalid page number" },
        { status: 400 }
      );
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      // Limitar el máximo de resultados por petición
      return NextResponse.json(
        { message: "Invalid limit value (must be 1-100)" },
        { status: 400 }
      );
    }

    // Llamar a tu Server Action existente
    const searchResult = await searchLocalImages(filters, page, limit);
    const totalPages = Math.ceil(searchResult.totalCount / limit);

    return NextResponse.json({
      images: searchResult.images,
      totalCount: searchResult.totalCount,
      currentPage: searchResult.currentPage,
      limit: limit, // Añadir el limit usado
      totalPages: totalPages, // Añadir el total de páginas
    });
  } catch (error) {
    console.error("[API /api/search] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { message: `Internal Server Error: ${message}` },
      { status: 500 }
    );
  }
}
