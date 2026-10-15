export const STATUSES = [
  { value: "pending_approval", label: "ממתין לאישור לקוח", color: "bg-amber-100 text-amber-800" },
  { value: "approved_waiting", label: "מאושר, ממתין", color: "bg-sky-100 text-sky-800" },
  { value: "in_progress", label: "בעבודה", color: "bg-indigo-100 text-indigo-800" },
  { value: "client_testing", label: "בדיקות לקוח", color: "bg-purple-100 text-purple-800" },
  { value: "in_production", label: "עלה לייצור", color: "bg-emerald-100 text-emerald-800" },
] as const;

export type StatusValue = (typeof STATUSES)[number]["value"];

export const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;
export const statusColor = (v: string) => STATUSES.find((s) => s.value === v)?.color ?? "bg-gray-100";

export type Role = "elad" | "client";
export const roleLabel = (r: Role) => (r === "elad" ? "אלעד" : "לקוח");

export interface Profile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: Role;
}

export interface Task {
  id: number;
  title: string;
  subject: string;
  site_id: number | null;
  client_id: string;
  status: StatusValue;
  estimated_hours: number | null;
  actual_hours: number | null;
  billed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
