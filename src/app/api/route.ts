import { getCorsHeaders, handleCorsPreflight } from "@/lib/cors.utils";
import { getDatabaseSizeMB } from "@/lib/database"; // Importar la función
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // 1. Obtener las cabeceras CORS utilizando la utilidad
  const corsHeaders = getCorsHeaders(request);

  const baseUrl = `${
    request.headers.get("x-forwarded-proto") || "http"
  }://${request.headers.get("host")}`;

  const currentDbSizeMB = getDatabaseSizeMB(); // Obtener el tamaño de la BD

  const apiInfo = {
    name: "Hivelens Image Index API",
    version: "v1.0.0",
    description_es:
      "API para buscar imágenes indexadas de la blockchain de Hive y obtener metadatos relacionados.",
    description_en:
      "API to search indexed images from the Hive blockchain and retrieve related metadata.",
    documentation_url:
      "https://github.com/theghost1980/hivelens/blob/master/README.md",
    current_database_size_mb: currentDbSizeMB ?? "N/A", // Añadir el tamaño de la BD
    _links: {
      self: {
        href: `${baseUrl}/api`,
      },
      search_images: {
        href: `${baseUrl}/api/search{?searchTerm,author,title,tags,dateFrom,dateTo,page,limit}`,
        templated: true,
      },
      available_tags: {
        href: `${baseUrl}/api/tags`,
      },
    },
  };

  // 2. Devolver la respuesta JSON incluyendo las cabeceras CORS
  // Si necesitas fusionar con otras cabeceras específicas de esta ruta:
  // const responseHeaders = new Headers(corsHeaders);
  // responseHeaders.set('X-Another-Header', 'value');
  // return NextResponse.json(apiInfo, { headers: responseHeaders });
  return NextResponse.json(apiInfo, { headers: corsHeaders });
}

// 3. Añadir el manejador para las solicitudes OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
