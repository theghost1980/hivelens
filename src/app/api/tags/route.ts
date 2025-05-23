import { fetchAllUniqueTags } from "@/app/actions"; // Tu Server Action para obtener tags
import { NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

// Configuración del Rate Limiter (ejemplo: 100 peticiones por minuto por IP)
// Duplicado desde /api/search/route.ts por simplicidad inicial.
// Considerar mover a un archivo compartido si hay muchas API routes.
const rateLimiter = new RateLimiterMemory({
  points: 10, // Número de puntos
  duration: 60, // Por segundo
});

// Función para obtener la IP del cliente
// Duplicado desde /api/search/route.ts por simplicidad inicial.
// Considerar mover a un archivo compartido si hay muchas API routes.
function getClientIp(request: Request): string {
  let ip: string | undefined | null;

  ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (ip) return ip;

  ip = request.headers.get("x-real-ip")?.trim();
  if (ip) return ip;

  // Fallback para entornos locales o si no se encuentran los headers anteriores.
  return "127.0.0.1";
}

export async function GET(request: Request) {
  const clientIp = getClientIp(request);

  try {
    await rateLimiter.consume(clientIp); // Consume 1 punto por petición
  } catch (rateLimiterRes) {
    // Si se excede el límite
    return NextResponse.json({ message: "Too Many Requests" }, { status: 429 });
  }

  try {
    // Llamar a tu Server Action existente para obtener todos los tags únicos
    const tags = await fetchAllUniqueTags();

    // Devolver la lista de tags en formato JSON
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
