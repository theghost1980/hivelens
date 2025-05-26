import { searchLocalImages } from "@/app/actions"; // Tu Server Action
import { getCorsHeaders, handleCorsPreflight } from "@/lib/cors.utils"; // Importar utilidades CORS
import { SearchFiltersDb } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server"; // Importar NextRequest
import { RateLimiterMemory } from "rate-limiter-flexible";

const rateLimiter = new RateLimiterMemory({
  points: 10, // Máximo 10 peticiones
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

export async function GET(request: NextRequest) {
  // Cambiado a NextRequest
  // Obtener las cabeceras CORS al inicio
  const corsHeaders = getCorsHeaders(request);

  const { searchParams } = new URL(request.url);

  const clientIp = getClientIp(request);
  try {
    await rateLimiter.consume(clientIp);
  } catch (rateLimiterRes) {
    return NextResponse.json(
      { message: "Too Many Requests" },
      { status: 429, headers: corsHeaders } // Añadir cabeceras CORS
    );
  }

  // Validar y parsear parámetros

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
        { status: 400, headers: corsHeaders } // Añadir cabeceras CORS
      );
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { message: "Invalid limit value (must be 1-100)" },
        { status: 400, headers: corsHeaders } // Añadir cabeceras CORS
      );
    }

    const searchResult = await searchLocalImages(filters, page, limit);
    const totalPages = Math.ceil(searchResult.totalCount / limit);

    return NextResponse.json(
      {
        images: searchResult.images,
        totalCount: searchResult.totalCount,
        currentPage: searchResult.currentPage,
        limit: limit,
        totalPages: totalPages,
      },
      { headers: corsHeaders }
    ); // Añadir cabeceras CORS
  } catch (error) {
    console.error("[API /api/search] Error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { message: `Internal Server Error: ${message}` },
      { status: 500, headers: corsHeaders } // Añadir cabeceras CORS
    );
  }
}

// Añadir el manejador para las solicitudes OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
