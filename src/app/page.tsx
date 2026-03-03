"use client";

import { useRef, useState } from "react";
import { InspectionDashboard } from "@/components/dashboard/InspectionDashboard";
import { useInspectionAnalysis } from "@/hooks/useInspectionAnalysis";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { state, report, warnings, errorMessage, progress, progressLabel, showLongRunningMessage, reset, analyze } =
    useInspectionAnalysis();

  const isAnalyzing = state === "uploading" || state === "reading" || state === "analyzing" || state === "building";

  function validateAndSelectFile(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setSelectedFile(null);
      setFileError("Please upload a PDF file.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null);
      setFileError("This PDF is over 10MB. Try compressing it or ask your inspector for a smaller file.");
      return;
    }

    setSelectedFile(file);
    setFileError("");
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      return;
    }
    setFileError("");
    await analyze(selectedFile);
  }

  function handleResetAnalysis() {
    setSelectedFile(null);
    setFileError("");
    setIsDragOver(false);
    reset();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">HomeInspectAI</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload your home inspection PDF and get a prioritized repair dashboard with urgency and cost ranges.
        </p>
      </header>

      {!report ? (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div
            role="button"
            tabIndex={0}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
              isDragOver
                ? "border-brand-500 bg-brand-50"
                : "border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              validateAndSelectFile(event.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => validateAndSelectFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-base font-semibold text-slate-900">
              {isDragOver ? "Drop your inspection report here" : "Drag and drop your inspection report"}
            </p>
            <p className="mt-2 text-sm text-slate-600">PDF only, up to 10MB</p>
            <p className="mt-4 text-xs text-slate-500">or click to browse files</p>
          </div>

          {selectedFile ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">{selectedFile.name}</span> ({formatFileSize(selectedFile.size)})
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !selectedFile}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Analyze Report
            </button>
          </div>

          {progressLabel ? (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between text-sm text-blue-800">
                <span>{progressLabel}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isAnalyzing ? <div className="mt-2 h-0.5 w-16 animate-pulse rounded bg-blue-400/70" /> : null}
            </div>
          ) : null}

          {showLongRunningMessage ? (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Large reports take a moment — we&apos;re reading every finding carefully
            </div>
          ) : null}

          {(fileError || errorMessage) ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {fileError || errorMessage}
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {warnings.join(" ")}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mb-8">
          <InspectionDashboard
            report={report}
            onReanalyze={handleResetAnalysis}
            pdfFilename={selectedFile?.name}
          />
          {warnings.length > 0 ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {warnings.join(" ")}
            </div>
          ) : null}
        </section>
      )}

      {!report && state === "success" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Analysis completed but no report was returned. Please retry.
        </div>
      ) : null}
    </main>
  );
}
