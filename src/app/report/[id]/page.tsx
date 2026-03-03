import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import type { InspectionReport } from "@/types/inspection";
import { InspectionDashboard } from "@/components/dashboard/InspectionDashboard";

interface ReportPageProps {
  params: {
    id: string;
  };
}

interface StoredReportRow {
  id: string;
  report_data: InspectionReport;
  view_count: number;
}

function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

async function getReportById(id: string): Promise<StoredReportRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, report_data, view_count")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as StoredReportRow;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

async function incrementViewCount(id: string, currentViewCount: number) {
  try {
    const supabase = createSupabaseServerClient();
    await supabase
      .from("reports")
      .update({ view_count: currentViewCount + 1 })
      .eq("id", id);
  } catch {
    // Intentionally non-blocking for page render.
  }
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const row = await getReportById(params.id);

  if (!row) {
    return {
      title: "Report Not Found",
      description: "This report link is invalid or has expired"
    };
  }

  const report = row.report_data;
  const categoriesCount = new Set(report.issues.map((issue) => issue.category)).size;
  const title = `Home Inspection Report — ${report.summary.criticalCount} Critical Issues Found`;
  const description = `Estimated repairs: ${formatCurrency(report.summary.estimatedTotalMin)}–${formatCurrency(report.summary.estimatedTotalMax)} across ${categoriesCount} categories`;

  return {
    title,
    description,
    openGraph: {
      title,
      description
    },
    twitter: {
      title,
      description
    }
  };
}

export default async function SharedReportPage({ params }: ReportPageProps) {
  const row = await getReportById(params.id);
  if (!row) {
    notFound();
  }

  const report = row.report_data;
  const currentViewCount = typeof row.view_count === "number" ? row.view_count : 0;
  void incrementViewCount(row.id, currentViewCount);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shared Home Inspection Report</h1>
      </header>

      <InspectionDashboard report={report} readOnly />

      <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
        <p>Viewed {currentViewCount + 1} times</p>
        <Link
          href="/"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Analyze your own report →
        </Link>
      </div>
    </main>
  );
}
