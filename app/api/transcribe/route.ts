import { transcribe } from "ai";
import { groq } from "@ai-sdk/groq";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const TRANSCRIPTION_TIMEOUT_MS = 60_000;
const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpga",
]);

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return errorResponse("Usuário não autenticado.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Não foi possível ler o áudio enviado.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return errorResponse("Envie um arquivo de áudio.", 400);
  }

  const mediaType = audio.type.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (!SUPPORTED_AUDIO_TYPES.has(mediaType)) {
    return errorResponse("Formato de áudio não suportado.", 415);
  }

  if (audio.size === 0) {
    return errorResponse("O áudio está vazio.", 422);
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return errorResponse("O áudio excede o limite de 10 MB.", 413);
  }

  try {
    const result = await transcribe({
      model: groq.transcription(TRANSCRIPTION_MODEL),
      audio: new Uint8Array(await audio.arrayBuffer()),
      providerOptions: {
        groq: {
          language: "pt",
          responseFormat: "json",
        },
      },
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });

    const text = result.text.trim();
    if (!text) {
      return errorResponse("Não foi possível detectar fala no áudio.", 422);
    }

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return errorResponse("A transcrição demorou demais. Tente gravar novamente.", 504);
    }

    return errorResponse("Não foi possível transcrever o áudio. Tente novamente.", 502);
  }
}
