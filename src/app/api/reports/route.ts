import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RECOMMENDED_ACTIONS, URGENCY_LEVELS } from "@/types/inspection";
const CATEGORY_VALUES = [
  "Roof",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Foundation",
  "Structure",
  "Exterior",
  "Interior",
  "Appliances",
  "Safety",
  "Other"
] as const;

const repairItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  urgency: z.enum(URGENCY_LEVELS),
  category: z.enum(CATEGORY_VALUES),
  estimatedCost: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    confidenceNote: z.string().optional()
  }),
  recommendedAction: z.enum(RECOMMENDED_ACTIONS)
});

const inspectionReportSchema = z
  .object({
  id: z.string().uuid(),
  propertyAddress: z.string().optional(),
  generatedAt: z.string(),
  issues: z.array(z.any()),
  summary: z.object({
    totalIssues: z.number().int().nonnegative(),
    criticalCount: z.number().int().nonnegative(),
    highCount: z.number().int().nonnegative(),
    mediumCount: z.number().int().nonnegative(),
    lowCount: z.number().int().nonnegative(),
    cosmeticCount: z.number().int().nonnegative(),
    estimatedTotalMin: z.number().int().nonnegative(),
    estimatedTotalMax: z.number().int().nonnegative()
  })
  })
  .passthrough();

const saveReportSchema = z.object({
  reportData: inspectionReportSchema,
  pdfFilename: z.string().min(1).max(512)
});

function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    console.log("[reports] raw body:", JSON.stringify(rawBody, null, 2));
    const body = saveReportSchema.parse(rawBody);
    const supabase = createSupabaseServerClient();
    console.log("[reports] supabase url:", process.env.NEXT_PUBLIC_SUPABASE_URL);

    try {
      const { data, error } = await supabase
        .from("reports")
        .insert({
          report_data: body.reportData,
          summary: body.reportData.summary,
          pdf_filename: body.pdfFilename
        })
        .select("id")
        .single();

      if (error) {
        console.log("[reports] supabase error:", JSON.stringify(error, null, 2));
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data?.id) {
        return NextResponse.json({ error: "Insert failed" }, { status: 500 });
      }

      const id = data.id;
      return NextResponse.json({ id, shareUrl: `/report/${id}` });
    } catch (err) {
      console.log("[reports] caught error:", err);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
  } catch (error) {
    console.log(
      "[reports] validation error:",
      JSON.stringify(error instanceof z.ZodError ? error.errors : error, null, 2)
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid report payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Couldn't generate share link. Your analysis is still saved locally." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("reports")
      .select("id, report_data, summary, pdf_filename, created_at, view_count")
      .eq("id", parsedId.data)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "This report link is invalid or has expired" }, { status: 404 });
    }

    const currentViewCount = typeof data.view_count === "number" ? data.view_count : 0;
    void supabase.from("reports").update({ view_count: currentViewCount + 1 }).eq("id", parsedId.data);

    return NextResponse.json({
      id: data.id,
      reportData: data.report_data,
      summary: data.summary,
      pdfFilename: data.pdf_filename,
      createdAt: data.created_at,
      viewCount: currentViewCount + 1
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong loading this report." }, { status: 500 });
  }
}
