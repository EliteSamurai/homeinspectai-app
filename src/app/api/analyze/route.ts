import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { RECOMMENDED_ACTIONS, URGENCY_LEVELS } from "@/types/inspection";
import type { AnalyzeResponse, InspectionReport, RepairItem } from "@/types/inspection";
import { ANALYZE_REPORT_SYSTEM_PROMPT, createInspectionUserPrompt } from "@/lib/prompts/inspectionPrompt";

export const runtime = "nodejs";
// Vercel Pro allows up to 60s for this route (Hobby is capped lower, typically 10s).
export const maxDuration = 60;

const issueSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  urgency: z.enum(URGENCY_LEVELS),
  category: z.string().min(1),
  estimatedCost: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    confidenceNote: z.string().optional()
  }),
  recommendedAction: z.enum(RECOMMENDED_ACTIONS)
});

const parsedReportSchema = z.object({
  propertyAddress: z.string().nullable().optional(),
  issues: z.array(issueSchema)
});

function extractJson(rawText: string): unknown {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON.");
  }
  const jsonText = rawText.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function buildSummary(items: RepairItem[]): InspectionReport["summary"] {
  const count = (urgency: RepairItem["urgency"]) =>
    items.filter((item) => item.urgency === urgency).length;

  return {
    totalIssues: items.length,
    criticalCount: count("Critical"),
    highCount: count("High"),
    mediumCount: count("Medium"),
    lowCount: count("Low"),
    cosmeticCount: count("Cosmetic"),
    estimatedTotalMin: items.reduce((sum, item) => sum + item.estimatedCost.min, 0),
    estimatedTotalMax: items.reduce((sum, item) => sum + item.estimatedCost.max, 0)
  };
}

const SCANNED_PDF_ERROR =
  "Could not extract text from this PDF. Make sure it's a text-based PDF, not a scanned image.";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Analysis service is not configured. Add your ANTHROPIC_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("report");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Invalid request: expected 'report' file upload." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported for this MVP." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "This PDF is over 10MB. Try compressing it or ask your inspector for a smaller file." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pdfParseModule = (await import("pdf-parse/lib/pdf-parse.js")) as {
      default: (buffer: Buffer) => Promise<{ text: string }>;
    };
    const parsedPdf = await pdfParseModule.default(fileBuffer);
    const rawText = parsedPdf.text.trim();

    if (rawText.length < 200) {
      return NextResponse.json(
        { error: SCANNED_PDF_ERROR },
        { status: 400 }
      );
    }

    const promptInput = rawText.length > 120_000 ? rawText.slice(0, 120_000) : rawText;
    const baseUserPrompt = createInspectionUserPrompt(promptInput);

    const anthropic = new Anthropic({ apiKey });
    const requestCompletion = async (prompt: string, attempt: number) => {
      const completion = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.2,
        system: ANALYZE_REPORT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }]
      });

      if (process.env.NODE_ENV === "development") {
        console.log("[analyze] claude usage", {
          attempt,
          model: "claude-sonnet-4-20250514",
          usage: completion.usage
        });
      }

      return completion;
    };

    const completionToText = (completion: Awaited<ReturnType<typeof requestCompletion>>) =>
      completion.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

    const parseClaudeJson = (text: string) => parsedReportSchema.parse(extractJson(text));

    let parsed: z.infer<typeof parsedReportSchema>;
    try {
      const firstCompletion = await requestCompletion(baseUserPrompt, 1);
      parsed = parseClaudeJson(completionToText(firstCompletion));
    } catch (firstParseError) {
      const shouldRetryForMalformedJson =
        firstParseError instanceof SyntaxError ||
        (firstParseError instanceof Error && firstParseError.message.includes("did not return JSON"));

      if (!shouldRetryForMalformedJson) {
        throw firstParseError;
      }

      const secondCompletion = await requestCompletion(
        `${baseUserPrompt}\n\nYou must respond with ONLY valid JSON, no commentary`,
        2
      );
      parsed = parseClaudeJson(completionToText(secondCompletion));
    }

    const issues: RepairItem[] = parsed.issues.map((issue) => ({
      id: crypto.randomUUID(),
      ...issue,
      estimatedCost: {
        ...issue.estimatedCost,
        min: Math.min(issue.estimatedCost.min, issue.estimatedCost.max),
        max: Math.max(issue.estimatedCost.min, issue.estimatedCost.max)
      }
    }));

    const report: InspectionReport = {
      id: crypto.randomUUID(),
      propertyAddress: parsed.propertyAddress ?? undefined,
      generatedAt: new Date().toISOString(),
      issues,
      summary: buildSummary(issues)
    };

    const response: AnalyzeResponse = {
      report,
      warnings: rawText.length > 120_000 ? ["Large report truncated to first 120,000 characters."] : []
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Something went wrong analyzing your report. Please try again or use a different PDF.",
          details: error.issues
        },
        { status: 502 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Something went wrong analyzing your report. Please try again or use a different PDF." },
        { status: 502 }
      );
    }

    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("timeout") ||
        error.message.toLowerCase().includes("anthropic") ||
        error.message.toLowerCase().includes("overloaded") ||
        error.message.toLowerCase().includes("rate limit"))
    ) {
      return NextResponse.json(
        {
          error: "Analysis timed out. Inspection reports over 100 pages may need a moment — please try again."
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong analyzing your report. Please try again or use a different PDF." },
      { status: 500 }
    );
  }
}
