export interface Status {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  awaiting_client: boolean; // client may change the status of tasks in it
  client_selectable: boolean; // client may move a task into it
}

// Full class names so Tailwind can see them.
export const STATUS_COLORS: Record<string, { label: string; cls: string }> = {
  gray: { label: "אפור", cls: "bg-gray-100 text-gray-800" },
  amber: { label: "כתום", cls: "bg-amber-100 text-amber-800" },
  sky: { label: "תכלת", cls: "bg-sky-100 text-sky-800" },
  indigo: { label: "כחול", cls: "bg-indigo-100 text-indigo-800" },
  purple: { label: "סגול", cls: "bg-purple-100 text-purple-800" },
  emerald: { label: "ירוק", cls: "bg-emerald-100 text-emerald-800" },
  red: { label: "אדום", cls: "bg-red-100 text-red-800" },
  pink: { label: "ורוד", cls: "bg-pink-100 text-pink-800" },
};
export const statusClass = (color: string) => (STATUS_COLORS[color] ?? STATUS_COLORS.gray).cls;

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
  status_id: number;
  estimated_hours: number | null;
  actual_hours: number | null;
  billed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
