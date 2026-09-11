"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, CircleX, Loader2, Mic, MicOff, Pencil, Sparkles, Square, Trash2 } from "lucide-react";
import {
  importWithAIAction,
  saveAiTransactionsAction,
  type AiTransaction,
} from "@/actions/ai-import";
import { formatCurrency, formatDate } from "@/lib/format";
import { ConfirmModal } from "@/components/ConfirmModal";

const PLACEHOLDER = `Cole aqui o texto do extrato, fatura ou planilha. Exemplo:

10/09 Financiamento do apê - débito em conta R$ 3.200,00
15/09 Condomínio boleto 850,90
05/09 Salário depósito 8.500,00`;

type IntelligentLaunchState =
  | "idle"
  | "requesting-permission"
  | "analyzing"
  | "results"
  | "recording"
  | "transcribing";

export function AiImportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [stage, setStage] = useState<IntelligentLaunchState>("idle");
  const [preview, setPreview] = useState<AiTransaction[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const waveformLevelRef = useRef(0);
  const mountedRef = useRef(true);
  const [waveformHeights, setWaveformHeights] = useState([8, 12, 18, 24, 30, 36, 30, 24, 18, 12, 8]);

  const isClosingBlocked =
    isBusy ||
    stage === "requesting-permission" ||
    stage === "recording" ||
    stage === "transcribing";

  const editingItem = editingIndex === null ? null : preview[editingIndex];
  const deletingItem = deletingIndex === null ? null : preview[deletingIndex];
  const hasIncompletePreview = preview.some((item) =>
    !item.title?.trim() ||
    item.amount === null ||
    item.amount <= 0 ||
    !item.dueDate ||
    !item.type ||
    !item.paymentMethod?.trim(),
  );

  function stopWaveform() {
    if (waveformFrameRef.current !== null) {
      cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;
    waveformLevelRef.current = 0;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  }

  function startWaveform(stream: MediaStream) {
    if (!window.AudioContext) return;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      const weights = [0.45, 0.55, 0.7, 0.82, 0.92, 1, 0.92, 0.82, 0.7, 0.55, 0.45];
      const GAIN = 10;
      const MIN_HEIGHT = 8;
      const MAX_HEIGHT = 52;
      const ATTACK = 0.35;
      const RELEASE = 0.12;

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      const data = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      void audioContext.resume().catch(() => undefined);

      const animate = () => {
        if (!mountedRef.current || analyserRef.current !== analyser) return;

        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let index = 0; index < data.length; index += 1) {
          const normalized = (data[index] - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / data.length);
        const targetLevel = Math.min(1, rms * GAIN);
        const smoothing = targetLevel > waveformLevelRef.current ? ATTACK : RELEASE;
        waveformLevelRef.current += (targetLevel - waveformLevelRef.current) * smoothing;
        const level = waveformLevelRef.current;
        const heights = weights.map((weight) =>
          Math.round(MIN_HEIGHT + level * weight * (MAX_HEIGHT - MIN_HEIGHT)),
        );

        setWaveformHeights(heights);
        waveformFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch {
      stopWaveform();
    }
  }

  const close = useCallback(() => {
    if (isClosingBlocked) return;

    setIsOpen(false);
    setRawText("");
    setStage("idle");
    setPreview([]);
    setEditingIndex(null);
    setDeletingIndex(null);
  }, [isClosingBlocked]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isClosingBlocked) close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isClosingBlocked, close]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.onerror = null;
        recorderRef.current.stop();
      }
      stopWaveform();
      transcriptionAbortRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (stage !== "recording") return;

    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [stage]);

  async function handleExtract(inputText = rawText) {
    if (stage !== "idle" || isBusy || inputText.trim().length < 10) return;

    setIsBusy(true);
    setStage("analyzing");
    const toastId = toast.loading("Analisando seus dados...");

    try {
      const result = await importWithAIAction(inputText);

      if (!result.success) {
        toast.error(result.message, { id: toastId });
        setStage("idle");
        setRecordingSeconds(0);
        return;
      }

      setPreview(result.data.transactions);
      setStage("results");
      toast.success(
        `${result.data.transactions.length} lançamento(s) encontrado(s)`,
        {
          id: toastId,
          description:
            result.data.discarded > 0
              ? `${result.data.discarded} descartado(s) por dados inconsistentes`
              : "Revise antes de salvar",
        },
      );
    } catch {
      toast.error("Não foi possível analisar os lançamentos. Tente novamente.", {
        id: toastId,
      });
      setStage("idle");
    } finally {
      setIsBusy(false);
    }
  }

  async function transcribeRecording(blob: Blob) {
    setStage("transcribing");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    transcriptionAbortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("audio", blob, "lancamento.webm");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const result = (await response.json()) as { text?: string; message?: string };

      if (!response.ok) {
        toast.error(result.message ?? "Não foi possível transcrever o áudio.");
        setStage("idle");
        return;
      }

      const text = result.text?.trim() ?? "";
      if (!text) {
        toast.error("Não detectamos uma fala. Tente gravar novamente.");
        setStage("idle");
        return;
      }

      setRawText(text);
      setStage("idle");
      await handleExtract(text);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (mountedRef.current) {
          toast.error("A transcrição demorou demais. Tente gravar novamente.");
          setStage("idle");
        }
        return;
      }
      toast.error("Não foi possível transcrever o áudio. Tente novamente.");
      setStage("idle");
    } finally {
      window.clearTimeout(timeout);
      if (transcriptionAbortRef.current === controller) {
        transcriptionAbortRef.current = null;
      }
    }
  }

  async function startRecording() {
    if (stage !== "idle" || isBusy) return;

    setRecordingSeconds(0);
    setStage("requesting-permission");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStage("idle");
      toast.error("Seu navegador não suporta gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || !isOpen) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopWaveform();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setStage("idle");
        toast.error("A gravação falhou. Tente novamente.");
      };
      recorder.onstop = () => {
        if (!mountedRef.current) return;

        stopWaveform();
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        audioChunksRef.current = [];

        if (audioBlob.size === 0) {
          setStage("idle");
          toast.error("Não detectamos uma fala. Tente gravar novamente.");
          return;
        }

        void transcribeRecording(audioBlob);
      };
      recorder.start();
      startWaveform(stream);
      setStage("recording");
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      stopWaveform();
      streamRef.current = null;
      recorderRef.current = null;
      setStage("idle");
      toast.error(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Permita o acesso ao microfone para gravar um lançamento."
          : "Não foi possível acessar o microfone.",
      );
    }
  }

  function stopRecording() {
    if (stage !== "recording") return;
    setStage("transcribing");
    recorderRef.current?.stop();
  }

  function cancelRecording() {
    if (
      stage !== "requesting-permission" &&
      stage !== "recording" &&
      stage !== "transcribing"
    ) return;

    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;
    if (stage === "recording" && recorderRef.current) {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    stopWaveform();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioChunksRef.current = [];
    setIsOpen(false);
    setRawText("");
    setStage("idle");
    setRecordingSeconds(0);
    setPreview([]);
    setEditingIndex(null);
    setDeletingIndex(null);
  }

  async function handleSave() {
    if (stage !== "results" || isBusy || preview.length === 0) return;

    setIsBusy(true);

    try {
      const result = await saveAiTransactionsAction(preview);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${result.data.imported} lançamento(s) importado(s)`);
      close();
    } catch {
      toast.error("Não foi possível salvar os lançamentos. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  }

  function removePreviewItem() {
    if (deletingIndex === null) return;

    setPreview((items) => items.filter((_, index) => index !== deletingIndex));
    setDeletingIndex(null);
  }

  function updatePreviewItem(field: keyof AiTransaction, value: string) {
    if (editingIndex === null) return;

    setPreview((items) =>
      items.map((item, index) =>
        index === editingIndex
          ? {
              ...item,
              [field]:
                field === "amount"
                  ? value.trim() === ""
                    ? null
                    : Number(value) || null
                  : value,
            }
          : item,
      ),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="col-span-2 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#10B981] bg-gradient-to-r from-[#0FBA82] to-[#33D499] px-4 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(15,186,130,0.3)] transition-opacity hover:opacity-90 lg:h-9 lg:w-auto"
      >
        <Sparkles className="size-4" aria-hidden />
        Lançamento Inteligente
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm"
            onClick={() => {
              if (!isBusy) close();
            }}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-import-title"
            className={`relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col gap-4 rounded-2xl border border-[#334155] bg-[#172033] px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.25)] sm:gap-6 sm:px-8 sm:py-9 [@media(max-height:800px)]:gap-4 [@media(max-height:800px)]:py-5 ${
              stage === "results" ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            {stage !== "results" && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="ai-import-title"
                  className="flex items-start gap-3 font-outfit text-[23px] font-bold leading-[1.14] text-[#F8FAFC] sm:text-2xl"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/10 text-[#10B981]">
                    <Sparkles className="size-5" aria-hidden />
                  </span>
                  Leitura e Lançamento Inteligente
                </h2>
                <p className="mt-3 text-base leading-[1.4] text-[#94A3B8] sm:text-sm [@media(max-height:800px)]:mt-2">
                  {stage === "recording"
                    ? "Fale naturalmente. O sistema identifica valores, descrições e datas enquanto você fala."
                    : "Cole seu extrato, fatura ou planilha abaixo. Nossa inteligência artificial organiza os dados automaticamente para você."}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                disabled={isClosingBlocked}
                className="shrink-0 rounded-lg p-1 text-[#94A3B8] transition-colors hover:bg-[#172033] hover:text-[#F8FAFC]"
              >
                <CircleX className="size-4" aria-hidden />
              </button>
            </div>
            )}

            {stage === "results" && (
              <div className="mx-5 flex items-center gap-3 rounded-xl border border-[#10B981]/40 bg-[#052E20] px-4 py-3 sm:mx-8">
                <Check className="size-5 text-[#34D399]" aria-hidden />
                <div><p className="text-sm font-bold text-[#34D399]">{preview.length} lançamento{preview.length === 1 ? "" : "s"} encontrado{preview.length === 1 ? "" : "s"}</p><p className="text-xs text-[#A7F3D0]">Revise antes de salvar.</p></div>
              </div>
            )}

            <div className={stage === "results" ? "min-h-0 flex-1 overflow-y-auto" : ""}>
            {stage === "recording" ? (
              <div className="space-y-4">
                <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-[#10B981] bg-[#020617] px-6 py-4">
                  <div className="flex items-center gap-2 text-[13px] font-bold uppercase text-[#34D399]">
                    <span className="size-2 animate-pulse rounded-full bg-[#34D399]" aria-hidden />
                    Captando áudio
                  </div>
                  <div className="flex h-[58px] w-full items-center justify-center gap-2" aria-hidden>
                    {waveformHeights.map((height, index) => (
                      <span
                        key={index}
                        className="w-1 rounded-full bg-[#34D399] transition-[height] duration-100 motion-reduce:transition-none"
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                  <p className="font-outfit text-[28px] font-bold leading-none text-[#F8FAFC]">
                    {`${Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:${(recordingSeconds % 60).toString().padStart(2, "0")}`}
                  </p>
                  <p className="text-center text-[13px] text-[#94A3B8]">Continue falando ou toque no microfone para parar</p>
                  <button
                    type="button"
                    onClick={stopRecording}
                    aria-label="Parar gravação"
                    aria-pressed={stage === "recording"}
                    className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#F87171] bg-[#F87171]/10 text-[#F87171] transition-colors"
                  >
                    <span className="absolute inset-0 animate-ping rounded-xl border border-[#F87171]/60" aria-hidden />
                    <Square className="relative size-4 fill-current" aria-hidden />
                  </button>
                </div>
                <div className="w-full rounded-lg border border-[#334155] bg-[#172033] p-4">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <p className="font-bold text-[#F8FAFC]">Transcrição em tempo real</p>
                    <p className="text-xs text-[#10B981]">Ouvindo...</p>
                  </div>
                  <p className="mt-2 text-sm leading-[1.5] text-[#94A3B8]">A transcrição será exibida quando você tocar em parar.</p>
                </div>
              </div>
            ) : stage === "idle" || stage === "requesting-permission" || stage === "transcribing" ? (
              <>
                <textarea
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={8}
                  disabled={isBusy}
                  readOnly={stage !== "idle"}
                  className="h-[224px] w-full resize-none rounded-lg border border-[#334155] bg-[#020617] p-3.5 text-sm leading-5 text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] focus:border-[#10B981] disabled:opacity-60"
                />
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={stage === "requesting-permission" || stage === "transcribing"}
                    aria-label="Falar lançamento"
                    className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#10B981] bg-[#10B981]/10 text-[#10B981] transition-colors hover:bg-[#10B981]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mic className="size-5" aria-hidden />
                  </button>
                  <div role="status" aria-live="polite">
                      <p className="text-sm font-bold text-[#F8FAFC]">{stage === "requesting-permission" ? "Preparando microfone..." : stage === "transcribing" ? "Transcrevendo..." : "Fale seus lançamentos"}</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#94A3B8]">
                        {"Diga os valores e descrições - o sistema converte em lançamento."}
                      </p>
                    </div>
                </div>
              </>
            ) : stage === "analyzing" ? (
              <>
                <div className="flex h-[224px] flex-col justify-center gap-3 rounded-lg border border-[#334155] bg-[#020617] p-4">
                  {["w-full", "w-2/3", "w-full", "w-1/2", "w-5/6", "w-full"].map((width, index) => <span key={index} className={`h-3 animate-pulse rounded-full bg-[#1E293B] ${width}`} />)}
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-[#94A3B8]"><Sparkles className="size-4 text-[#10B981]" aria-hidden />Analisando seus lançamentos...</p>
                <div className="mt-5 flex items-center gap-3 opacity-50"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#10B981] bg-[#10B981]/10 text-[#10B981]"><MicOff className="size-5" aria-hidden /></span><div><p className="text-sm font-bold text-[#F8FAFC]">Fale seus lançamentos</p><p className="mt-1 text-[13px] text-[#94A3B8]">Diga os valores e descrições - o sistema converte em lançamento.</p></div></div>
              </>
            ) : (
              <><h2 className="font-outfit text-xl font-bold text-[#F8FAFC]">Leitura e Lançamento Inteligente</h2><p className="mt-2 text-sm text-[#94A3B8]">Revise os dados identificados antes de salvar.</p><div className="mt-4 space-y-3 pb-4">{preview.map((item, index) => <article key={`${item.title ?? "draft"}-${index}`} className="rounded-2xl border border-[#334155] bg-[#172033] p-4"><div className="flex items-start gap-2"><h3 className="min-w-0 flex-1 text-base font-bold text-[#F8FAFC]">{item.title ?? "Título ausente"}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.type === "INCOME" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F87171]/10 text-[#F87171]"}`}>{item.type === "INCOME" ? "Receita" : item.type === "EXPENSE" ? "Despesa" : "Tipo ausente"}</span><button type="button" onClick={() => setEditingIndex(index)} aria-label={`Editar ${item.title ?? "lançamento"}`} className="rounded-lg border border-[#334155] p-1.5 text-[#94A3B8]"><Pencil className="size-4" /></button><button type="button" onClick={() => setDeletingIndex(index)} aria-label={`Excluir ${item.title ?? "lançamento"}`} className="rounded-lg border border-[#334155] p-1.5 text-[#94A3B8]"><Trash2 className="size-4" /></button></div><dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[#64748B]">Método</dt><dd className="mt-1 text-[#94A3B8]">{item.paymentMethod ?? "Não informado"}</dd></div><div><dt className="text-[#64748B]">Data</dt><dd className="mt-1 text-[#94A3B8]">{item.dueDate ? formatDate(`${item.dueDate}T12:00:00.000Z`) : "Data ausente"}</dd></div><div className="col-span-2 flex items-end justify-between"><dt className="text-[#64748B]">Valor</dt><dd className={`font-outfit text-xl font-bold ${item.type === "INCOME" ? "text-[#34D399]" : "text-[#F87171]"}`}>{item.amount === null ? "Valor ausente" : formatCurrency(item.amount)}</dd></div></dl></article>)}</div></>
            )}
            </div>

            <div className={`flex shrink-0 gap-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:justify-end ${
              stage === "results" ? "flex-row" : "flex-col sm:flex-row"
            }`}>
              <button
                type="button"
                onClick={() => {
                  if (stage === "idle") close();
                  if (
                    stage === "requesting-permission" ||
                    stage === "recording" ||
                    stage === "transcribing"
                  ) cancelRecording();
                  if (stage === "results") {
                    setStage("idle");
                    setPreview([]);
                  }
                }}
                disabled={isBusy}
                className="order-2 inline-flex h-11 w-full shrink-0 items-center justify-center rounded-[10px] border border-[#334155] bg-transparent px-4 text-sm font-bold text-[#F8FAFC] transition-colors hover:border-[#475569] hover:bg-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60 md:order-1 md:h-10 md:w-auto"
              >
                {stage === "results" ? "Voltar" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={stage === "results" ? handleSave : stage === "recording" ? stopRecording : () => void handleExtract()}
                disabled={isBusy || stage === "requesting-permission" || stage === "transcribing" || (stage === "idle" && rawText.trim().length < 10) || (stage === "results" && hasIncompletePreview)}
                className="order-1 inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#10B981] to-[#34D399] px-4 text-sm font-bold text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 md:order-2 md:h-10 md:w-auto"
              >
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : stage === "recording" ? (
                  <Square className="size-4 fill-current" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {isBusy
                  ? "Analisando..."
                  : stage === "idle"
                    ? "Analisar lançamento"
                    : stage === "recording"
                      ? "Parar e revisar"
                      : stage === "requesting-permission"
                        ? "Preparando microfone..."
                        : stage === "transcribing"
                        ? "Transcrevendo..."
                    : `Salvar ${preview.length} lançamento${preview.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
          <ConfirmModal open={deletingItem !== null} title="Excluir lançamento?" description={<>Tem certeza que deseja excluir o lançamento <strong>{deletingItem?.title}</strong>? Esta ação não pode ser desfeita.</>} actions={[{ label: "Excluir", onClick: removePreviewItem }]} onClose={() => setDeletingIndex(null)} />
          {editingItem && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-[#020617]/80" onClick={() => setEditingIndex(null)} aria-hidden />
              <div role="dialog" aria-modal="true" aria-label="Editar lançamento" className="relative w-full max-w-md rounded-2xl border border-[#334155] bg-[#172033] p-5">
                <div className="flex items-center justify-between"><h2 className="font-outfit text-xl font-bold text-[#F8FAFC]">Editar lançamento</h2><button type="button" aria-label="Fechar" onClick={() => setEditingIndex(null)} className="text-[#94A3B8]"><CircleX className="size-5" /></button></div>
                <div className="mt-5 space-y-3"><input aria-label="Título" placeholder="Título obrigatório" className="h-12 w-full rounded-lg border border-[#334155] bg-[#020617] px-4 text-[#F8FAFC]" value={editingItem.title ?? ""} onChange={(event) => updatePreviewItem("title", event.target.value)} /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><select aria-label="Tipo" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-3 text-[#F8FAFC]" value={editingItem.type ?? ""} onChange={(event) => updatePreviewItem("type", event.target.value)}><option value="">Tipo obrigatório</option><option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option></select><input aria-label="Método" placeholder="Método obrigatório" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-4 text-[#F8FAFC]" value={editingItem.paymentMethod ?? ""} onChange={(event) => updatePreviewItem("paymentMethod", event.target.value)} /></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input aria-label="Data" type="date" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-3 text-[#F8FAFC]" value={editingItem.dueDate ?? ""} onChange={(event) => updatePreviewItem("dueDate", event.target.value)} /><input aria-label="Valor" type="number" step="0.01" placeholder="Valor obrigatório" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-3 text-[#F8FAFC]" value={editingItem.amount ?? ""} onChange={(event) => updatePreviewItem("amount", event.target.value)} /></div></div>
                <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingIndex(null)} className="h-10 rounded-lg border border-[#334155] px-4 text-sm font-semibold text-[#F8FAFC]">Cancelar</button><button type="button" onClick={() => setEditingIndex(null)} className="h-10 rounded-lg bg-[#10B981] px-4 text-sm font-bold text-[#020617]">Salvar alterações</button></div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
