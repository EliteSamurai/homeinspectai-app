"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeResponse, InspectionReport } from "@/types/inspection";

export type AnalyzeState = "idle" | "uploading" | "reading" | "analyzing" | "building" | "success" | "error";

const THIRTY_SECONDS_MS = 30_000;

const HUMAN_ERROR_MESSAGES = {
  fileTooLarge:
    "This PDF is over 10MB. Try compressing it or ask your inspector for a smaller file.",
  scannedPdf:
    "This looks like a scanned PDF. We need a text-based PDF to analyze it. Most inspection software exports text-based PDFs by default.",
  missingApiKey: "Analysis service is not configured. Add your ANTHROPIC_API_KEY to .env.local",
  timeout:
    "Analysis timed out. Inspection reports over 100 pages may need a moment — please try again.",
  fallback: "Something went wrong analyzing your report. Please try again or use a different PDF."
} as const;

function mapErrorMessage(rawMessage: string, statusCode?: number): string {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("over 10mb") || normalized.includes("too large") || statusCode === 413) {
    return HUMAN_ERROR_MESSAGES.fileTooLarge;
  }

  if (
    normalized.includes("text-based pdf") ||
    normalized.includes("scanned") ||
    normalized.includes("could not extract text")
  ) {
    return HUMAN_ERROR_MESSAGES.scannedPdf;
  }

  if (normalized.includes("anthropic_api_key") || normalized.includes("not configured")) {
    return HUMAN_ERROR_MESSAGES.missingApiKey;
  }

  if (normalized.includes("timed out") || normalized.includes("timeout") || statusCode === 504) {
    return HUMAN_ERROR_MESSAGES.timeout;
  }

  return HUMAN_ERROR_MESSAGES.fallback;
}

export function useInspectionAnalysis() {
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [state, setState] = useState<AnalyzeState>("idle");
  const [progress, setProgress] = useState(0);
  const [showLongRunningMessage, setShowLongRunningMessage] = useState(false);
  const slowTimerRef = useRef<number | null>(null);
  const analyzingPulseIntervalRef = useRef<number | null>(null);

  const progressLabel = useMemo(() => {
    switch (state) {
      case "uploading":
        return "Uploading report...";
      case "reading":
        return "Reading inspection data...";
      case "analyzing":
        return "Analyzing with AI...";
      case "building":
        return "Building your report...";
      default:
        return "";
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (slowTimerRef.current) {
        window.clearTimeout(slowTimerRef.current);
      }
      if (analyzingPulseIntervalRef.current) {
        window.clearInterval(analyzingPulseIntervalRef.current);
      }
    };
  }, []);

  function clearProgressTimers() {
    if (slowTimerRef.current) {
      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (analyzingPulseIntervalRef.current) {
      window.clearInterval(analyzingPulseIntervalRef.current);
      analyzingPulseIntervalRef.current = null;
    }
  }

  function reset() {
    clearProgressTimers();
    setState("idle");
    setProgress(0);
    setReport(null);
    setWarnings([]);
    setErrorMessage("");
    setShowLongRunningMessage(false);
  }

  async function analyze(file: File) {
    try {
      clearProgressTimers();
      setErrorMessage("");
      setWarnings([]);
      setShowLongRunningMessage(false);
      setReport(null);
      setState("uploading");
      setProgress(10);

      const formData = new FormData();
      formData.append("report", file);

      setState("reading");
      setProgress(35);
      await new Promise((resolve) => window.setTimeout(resolve, 150));

      setState("analyzing");
      setProgress(55);

      slowTimerRef.current = window.setTimeout(() => {
        setShowLongRunningMessage(true);
      }, THIRTY_SECONDS_MS);

      analyzingPulseIntervalRef.current = window.setInterval(() => {
        setProgress((current) => (current < 90 ? Math.min(90, current + 2) : current));
      }, 800);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      clearProgressTimers();
      setShowLongRunningMessage(false);

      const payload = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) {
        throw new Error(mapErrorMessage(payload.error ?? "", response.status));
      }

      setState("building");
      setProgress(95);
      setReport(payload.report);
      setWarnings(payload.warnings ?? []);
      setState("success");
      setProgress(100);
    } catch (error) {
      clearProgressTimers();
      setState("error");
      setProgress(0);
      const knownMessages = Object.values(HUMAN_ERROR_MESSAGES);
      const rawMessage = error instanceof Error ? error.message : "";
      setErrorMessage(
        knownMessages.includes(rawMessage as (typeof knownMessages)[number])
          ? rawMessage
          : mapErrorMessage(rawMessage)
      );
      setShowLongRunningMessage(false);
    }
  }

  return {
    state,
    report,
    warnings,
    errorMessage,
    progress,
    progressLabel,
    showLongRunningMessage,
    reset,
    analyze
  };
}
