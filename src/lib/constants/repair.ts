import type { UrgencyLevel } from "@/types/inspection";

export const URGENCY_ORDER: UrgencyLevel[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Cosmetic"
];

export const URGENCY_BADGE_STYLES: Record<UrgencyLevel, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Low: "bg-sky-100 text-sky-700 border-sky-200",
  Cosmetic: "bg-slate-100 text-slate-700 border-slate-200"
};

export const CATEGORY_HINTS = [
  "Roof",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Foundation",
  "Structure",
  "Exterior",
  "Interior",
  "Appliances",
  "Safety"
] as const;
