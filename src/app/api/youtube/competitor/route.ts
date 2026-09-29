import { NextResponse } from "next/server";
import { analyzeCompetitor } from "@/lib/competitor-analysis";
import { CompetitorApiError, loadCompetitorData, parseCompetitorReference } from "@/lib/youtube-competitor-service";

export const runtime = "nodejs";

function invalidInput(message: string) {
  return NextResponse.json({ error: { code: "INVALID_INPUT", message } }, { status: 400 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidInput("La solicitud no tiene un formato válido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidInput("La solicitud no tiene un formato válido.");
  }
  const rawChannel = (body as Record<string, unknown>).channel;
  if (typeof rawChannel !== "string" || rawChannel.trim().length > 1000) {
    return invalidInput("Escribe una URL de canal, un @handle o un channel ID válido.");
  }
  const reference = parseCompetitorReference(rawChannel);
  if (!reference) return invalidInput("Usa una URL de canal de YouTube, un @handle, un channel ID o una URL antigua /c/nombre.");

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      error: {
        code: "API_KEY_MISSING",
        message: "La clave de YouTube Data API no está configurada. Añade YOUTUBE_API_KEY en el entorno del servidor.",
      },
    }, { status: 503 });
  }

  try {
    const data = await loadCompetitorData(reference, apiKey);
    const report = analyzeCompetitor(data.channel, data.videos);
    report.warnings.push(...data.quotaWarnings);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof CompetitorApiError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({
      error: { code: "YOUTUBE_ERROR", message: "Ocurrió un error al analizar el canal. Inténtalo de nuevo en unos momentos." },
    }, { status: 502 });
  }
}
