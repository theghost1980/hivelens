import { NextRequest, NextResponse } from "next/server";

// Lista de orígenes permitidos para desarrollo en localhost.
// Los desarrolladores pueden agregar aquí los puertos que usan para sus frontends.
const ALLOWED_LOCALHOST_ORIGINS: string[] = [
  "http://localhost:3000", // Ejemplo: Create React App, Next.js frontend dev
  "http://localhost:3001",
  "http://localhost:5173", // Ejemplo: Vite
  "http://localhost:9002", // Añadido para permitir el origen de tu cliente
  "http://localhost:8080", // Ejemplo: Vue CLI
  "http://localhost:4200", // Ejemplo: Angular CLI
  // Agrega otros puertos comunes que usen tus desarrolladores
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

  if (requestOrigin && ALLOWED_LOCALHOST_ORIGINS.includes(requestOrigin)) {
    corsHeaders.set("Access-Control-Allow-Origin", requestOrigin);
  } else if (process.env.NODE_ENV !== "production" && !requestOrigin) {
    // Para herramientas como Postman en desarrollo donde el Origin puede no estar presente,
    // permitir cualquier origen. Sé cauteloso con '*' en producción.
    corsHeaders.set("Access-Control-Allow-Origin", "*");
  }
  // Puedes agregar más cabeceras aquí si son comunes a todas las respuestas no-preflight
  // por ejemplo, 'Access-Control-Expose-Headers' si necesitas exponer alguna cabecera al cliente.

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
  const requestOrigin = request.headers.get("origin");
  const preflightHeaders = new Headers();

  if (requestOrigin && ALLOWED_LOCALHOST_ORIGINS.includes(requestOrigin)) {
    preflightHeaders.set("Access-Control-Allow-Origin", requestOrigin);
    preflightHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    preflightHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    ); // Ajusta según las cabeceras que tu cliente envíe
    preflightHeaders.set("Access-Control-Max-Age", "86400"); // Cachea la respuesta preflight por 1 día (opcional)
  } else if (process.env.NODE_ENV !== "production" && !requestOrigin) {
    // Para herramientas como Postman en desarrollo
    preflightHeaders.set("Access-Control-Allow-Origin", "*");
    preflightHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    preflightHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    preflightHeaders.set("Access-Control-Max-Age", "86400");
  }

  return new NextResponse(null, { status: 204, headers: preflightHeaders });
}
