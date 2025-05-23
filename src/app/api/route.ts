import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const baseUrl = `${
    request.headers.get("x-forwarded-proto") || "http"
  }://${request.headers.get("host")}`;

  const apiInfo = {
    name: "Hivelens Image Index API",
    version: "v1.0.0",
    description_es:
      "API para buscar imágenes indexadas de la blockchain de Hive y obtener metadatos relacionados.",
    description_en:
      "API to search indexed images from the Hive blockchain and retrieve related metadata.",
    documentation_url:
      "https://github.com/theghost1980/hivelens/blob/master/README.md",
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

  return NextResponse.json(apiInfo);
}
