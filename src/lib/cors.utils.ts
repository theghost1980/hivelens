import { NextRequest, NextResponse } from "next/server";

const DEVELOPMENT_WHITELISTED_ORIGINS: string[] = [
  "http://localhost:3000", // Ejemplo: Create React App, Next.js frontend dev
  "http://localhost:3001",
  "http://localhost:5173", // Ejemplo: Vite
  "http://localhost:9002", // Añadido para permitir el origen de tu cliente
  "http://localhost:8080", // Ejemplo: Vue CLI
  "http://localhost:4200", // Ejemplo: Angular CLI
];

/**
 * Genera las cabeceras CORS para una solicitud dada.
 * Principalmente establece 'Access-Control-Allow-Origin'.
 * @param request La solicitud entrante.
 * @returns Un objeto Headers con las cabeceras CORS configuradas.
 */
export function getCorsHeaders(request: NextRequest | Request): Headers {
  const requestOrigin = request.headers.get("origin");
  const corsHeaders = new Headers();
  let originAllowed = false;
  let effectiveAllowOriginHeaderValue: string | null = null;
  corsHeaders.set("Vary", "Origin");

  if (process.env.NODE_ENV === "production") {
    if (requestOrigin && requestOrigin.startsWith("https://")) {
      effectiveAllowOriginHeaderValue = requestOrigin;
      originAllowed = true;
    }
  } else {
    if (
      requestOrigin &&
      DEVELOPMENT_WHITELISTED_ORIGINS.includes(requestOrigin)
    ) {
      effectiveAllowOriginHeaderValue = requestOrigin;
      originAllowed = true;
    } else if (!requestOrigin) {
      effectiveAllowOriginHeaderValue = "*";
      originAllowed = true;
    }
  }

  if (originAllowed && effectiveAllowOriginHeaderValue) {
    corsHeaders.set(
      "Access-Control-Allow-Origin",
      effectiveAllowOriginHeaderValue
    );
    corsHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    corsHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    corsHeaders.set("Access-Control-Max-Age", "86400");
  }

  return corsHeaders;
}

/**
 * Maneja las solicitudes OPTIONS (preflight) para CORS.
 * @param request La solicitud entrante OPTIONS.
 * @returns Una NextResponse con las cabeceras CORS adecuadas y estado 204.
 */
export function handleCorsPreflight(
  request: NextRequest | Request
): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
