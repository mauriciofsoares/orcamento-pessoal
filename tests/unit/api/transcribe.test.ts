import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
const transcribeMock = vi.hoisted(() => vi.fn());
const groqMock = vi.hoisted(() => ({
  transcription: vi.fn((model: string) => ({ model })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth })),
}));
vi.mock("ai", () => ({ transcribe: transcribeMock }));
vi.mock("@ai-sdk/groq", () => ({ groq: groqMock }));

import { POST } from "@/app/api/transcribe/route";

function requestWithAudio(file: File) {
  const formData = new FormData();
  formData.append("audio", file);
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    body: formData,
  });
}

function audioFile(
  type = "audio/webm",
  bytes = new Uint8Array([1, 2, 3]),
) {
  return new File([bytes], "voice.webm", { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  transcribeMock.mockResolvedValue({ text: "gastei 87 reais no mercado hoje no cartão" });
});

describe("POST /api/transcribe", () => {
  it("rejeita usuário não autenticado", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(requestWithAudio(audioFile()));

    expect(response.status).toBe(401);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("rejeita MIME type não suportado", async () => {
    const response = await POST(requestWithAudio(audioFile("text/plain")));

    expect(response.status).toBe(415);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("aceita o MIME com codec produzido pelo MediaRecorder", async () => {
    const response = await POST(requestWithAudio(audioFile("audio/webm;codecs=opus")));

    expect(response.status).toBe(200);
    expect(transcribeMock).toHaveBeenCalledOnce();
  });

  it("rejeita áudio acima do limite", async () => {
    const response = await POST(
      requestWithAudio(audioFile("audio/webm", new Uint8Array(10 * 1024 * 1024 + 1))),
    );

    expect(response.status).toBe(413);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("rejeita áudio vazio", async () => {
    const response = await POST(requestWithAudio(audioFile("audio/webm", new Uint8Array())));

    expect(response.status).toBe(422);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it("encaminha áudio válido para Groq e retorna somente texto", async () => {
    const response = await POST(requestWithAudio(audioFile()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "gastei 87 reais no mercado hoje no cartão",
    });
    expect(groqMock.transcription).toHaveBeenCalledWith("whisper-large-v3-turbo");
    expect(transcribeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { model: "whisper-large-v3-turbo" },
        maxRetries: 0,
        providerOptions: { groq: { language: "pt", responseFormat: "json" } },
      }),
    );
  });

  it("rejeita transcrição vazia", async () => {
    transcribeMock.mockResolvedValue({ text: "   " });

    const response = await POST(requestWithAudio(audioFile()));

    expect(response.status).toBe(422);
  });

  it("trata falha do provider sem expor detalhes", async () => {
    transcribeMock.mockRejectedValue(new Error("provider secret details"));

    const response = await POST(requestWithAudio(audioFile()));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: "Não foi possível transcrever o áudio. Tente novamente.",
    });
  });
});
