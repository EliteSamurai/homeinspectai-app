export const URGENCY_LEVELS = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Cosmetic"
] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const RECOMMENDED_ACTIONS = [
  "Fix now",
  "Fix within 6 months",
  "Monitor",
  "Cosmetic only"
] as const;

export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

export interface CostEstimate {
  min: number;
  max: number;
  confidenceNote?: string;
}

export interface RepairItem {
  id: string;
  title: string;
  description: string;
  urgency: UrgencyLevel;
  category: string;
  estimatedCost: CostEstimate;
  recommendedAction: RecommendedAction;
}

export interface InspectionReport {
  id: string;
  propertyAddress?: string;
  generatedAt: string;
  issues: RepairItem[];
  summary: {
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    cosmeticCount: number;
    estimatedTotalMin: number;
    estimatedTotalMax: number;
  };
}

export interface AnalyzeResponse {
  report: InspectionReport;
  warnings: string[];
}
