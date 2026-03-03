"use client";

import { useMemo, useState } from "react";
import type { InspectionReport, RepairItem, UrgencyLevel } from "@/types/inspection";
import { URGENCY_BADGE_STYLES, URGENCY_ORDER } from "@/lib/constants/repair";

interface InspectionDashboardProps {
  report: InspectionReport;
  onReanalyze?: () => void;
  readOnly?: boolean;
  pdfFilename?: string;
}

type SortBy = "urgency" | "cost-high" | "cost-low";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value
  );

const urgencyRank = (urgency: UrgencyLevel) => URGENCY_ORDER.indexOf(urgency);

function sortIssues(items: RepairItem[], sortBy: SortBy): RepairItem[] {
  const criticalIssues = items.filter((item) => item.urgency === "Critical");
  const nonCriticalIssues = items.filter((item) => item.urgency !== "Critical");

  const sortWithinGroup = (list: RepairItem[]) => {
    if (sortBy === "urgency") {
      return [...list].sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency));
    }

    if (sortBy === "cost-high") {
      return [...list].sort((a, b) => b.estimatedCost.max - a.estimatedCost.max);
    }

    return [...list].sort((a, b) => a.estimatedCost.min - b.estimatedCost.min);
  };

  return [...sortWithinGroup(criticalIssues), ...sortWithinGroup(nonCriticalIssues)];
}

export function InspectionDashboard({ report, onReanalyze, readOnly = false, pdfFilename }: InspectionDashboardProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<"All" | UrgencyLevel>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<SortBy>("urgency");
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);
  const analyzedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(report.generatedAt)),
    [report.generatedAt]
  );

  const categories = useMemo(
    () => Array.from(new Set(report.issues.map((issue) => issue.category))).sort(),
    [report.issues]
  );

  const visibleIssues = useMemo(() => {
    const filtered = report.issues.filter((issue) => {
      const urgencyMatch = urgencyFilter === "All" || issue.urgency === urgencyFilter;
      const categoryMatch = categoryFilter === "All" || issue.category === categoryFilter;
      return urgencyMatch && categoryMatch;
    });

    return sortIssues(filtered, sortBy);
  }, [report.issues, urgencyFilter, categoryFilter, sortBy]);

  async function handleGenerateShareLink() {
    try {
      setIsGeneratingShareLink(true);
      setShareError("");

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reportData: report,
          pdfFilename: pdfFilename ?? "inspection-report.pdf"
        })
      });

      const payload = (await response.json()) as { shareUrl?: string; error?: string };
      if (!response.ok || !payload.shareUrl) {
        throw new Error(payload.error ?? "Couldn't generate share link. Your analysis is still saved locally.");
      }

      const absoluteUrl =
        typeof window === "undefined" ? payload.shareUrl : new URL(payload.shareUrl, window.location.origin).toString();
      setShareLink(absoluteUrl);
      setCopied(false);
    } catch {
      setShareError("Couldn't generate share link. Your analysis is still saved locally.");
    } finally {
      setIsGeneratingShareLink(false);
    }
  }

  async function handleCopyLink() {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError("Couldn't generate share link. Your analysis is still saved locally.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 shadow-sm">
        <p className="text-sm font-medium text-brand-900">Estimated Total</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-brand-900">
          {formatCurrency(report.summary.estimatedTotalMin)} - {formatCurrency(report.summary.estimatedTotalMax)}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Inspection Results Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">Report analyzed on {analyzedDate}</p>
        </div>
        {!readOnly && onReanalyze ? (
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onReanalyze}
          >
            Re-analyze
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Share this report</h3>
          <p className="mt-1 text-xs text-slate-500">Anyone with this link can view your report</p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            {!shareLink ? (
              <button
                type="button"
                onClick={handleGenerateShareLink}
                disabled={isGeneratingShareLink}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingShareLink ? "Generating link..." : "Get share link"}
              </button>
            ) : (
              <>
                <p className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {shareLink}
                </p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Copy link
                </button>
              </>
            )}
          </div>

          {copied ? <p className="mt-2 text-sm text-emerald-700">Link copied!</p> : null}
          {shareError ? <p className="mt-2 text-sm text-red-600">{shareError}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm text-slate-500">Critical Issues</p>
          <p className="text-2xl font-bold text-red-600">{report.summary.criticalCount}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">High Priority</p>
          <p className="text-2xl font-bold text-orange-600">{report.summary.highCount}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Total Issues</p>
          <p className="text-2xl font-bold text-slate-900">{report.summary.totalIssues}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Estimated Total Cost</p>
          <p className="text-xl font-extrabold text-slate-900">
            {formatCurrency(report.summary.estimatedTotalMin)} - {formatCurrency(report.summary.estimatedTotalMax)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={urgencyFilter}
          onChange={(event) => setUrgencyFilter(event.target.value as "All" | UrgencyLevel)}
        >
          <option value="All">All urgency levels</option>
          {URGENCY_ORDER.map((urgency) => (
            <option key={urgency} value={urgency}>
              {urgency}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="All">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortBy)}
        >
          <option value="urgency">Sort by urgency</option>
          <option value="cost-high">Sort by highest cost</option>
          <option value="cost-low">Sort by lowest cost</option>
        </select>

        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:ml-auto"
          onClick={() => window.print()}
        >
          Export to PDF
        </button>
      </div>

      <div className="space-y-3">
        {visibleIssues.map((issue) => (
          <article key={issue.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{issue.title}</h3>
              <span
                className={`rounded-full border px-2 py-1 text-xs font-semibold ${URGENCY_BADGE_STYLES[issue.urgency]}`}
              >
                {issue.urgency}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{issue.category}</span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-700">{issue.description}</p>

            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p className="text-base">
                <span className="font-medium text-slate-800">Cost:</span>{" "}
                <span className="font-extrabold text-slate-900">
                  {formatCurrency(issue.estimatedCost.min)} - {formatCurrency(issue.estimatedCost.max)}
                </span>
              </p>
              <p>
                <span className="font-medium text-slate-800">Action:</span> {issue.recommendedAction}
              </p>
            </div>

            {issue.estimatedCost.confidenceNote ? (
              <p className="mt-2 text-xs text-slate-500">Note: {issue.estimatedCost.confidenceNote}</p>
            ) : null}
          </article>
        ))}

        {visibleIssues.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No issues match your current filters.
          </p>
        ) : null}
      </div>
    </section>
  );
}
