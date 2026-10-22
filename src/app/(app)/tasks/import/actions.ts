"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireElad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusValue } from "@/lib/constants";

export interface ImportState {
  error?: string;
  imported?: number;
  skipped?: number;
  unknownStatuses?: string[];
}

// Excel "סטטוס" values -> app statuses. Unmapped values fall back to pending_approval.
const STATUS_MAP: Record<string, StatusValue> = {
  "ממתין": "pending_approval",
  "ממתין לאישור לקוח": "pending_approval",
  "מאושר לקוח": "approved_waiting",
  "מאושר, ממתין": "approved_waiting",
  "בעבודה": "in_progress",
  "חסום": "in_progress",
  "בדיקות לקוח": "client_testing",
  "עלה לפרודקשן": "in_production",
  "עלה לייצור": "in_production",
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString("he-IL", { timeZone: "UTC" });
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
}

function cellNumber(v: ExcelJS.CellValue): number | null {
  const raw = typeof v === "object" && v && "result" in v ? (v.result as unknown) : v;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export async function importTasks(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const me = await requireElad();
  const file = formData.get("file");
  const clientId = String(formData.get("client_id") ?? "");
  const siteId = Number(formData.get("site_id")) || null;
  if (!(file instanceof File) || file.size === 0) return { error: "נא לבחור קובץ אקסל" };
  if (!clientId) return { error: "נא לבחור לקוח" };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "לא ניתן לקרוא את הקובץ (נדרש .xlsx)" };
  }
  const ws = wb.worksheets[0]; // first tab only
  if (!ws) return { error: "הקובץ ריק" };

  // Map columns by header name so column order doesn't matter.
  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((c, n) => {
    col[cellText(c.value)] = n;
  });
  if (!col["משימה"] && !col["נושא כללי"]) return { error: "לא נמצאו העמודות 'משימה' / 'נושא כללי' בשורה הראשונה" };
  const get = (row: ExcelJS.Row, name: string) => (col[name] ? row.getCell(col[name]).value : null);

  const db = createAdminClient();
  let q = db.from("tasks").select("title, subject").eq("client_id", clientId);
  q = siteId ? q.eq("site_id", siteId) : q.is("site_id", null);
  const { data: existing } = await q;
  const seen = new Set((existing ?? []).map((t) => `${t.title}|${t.subject}`));

  const unknown = new Set<string>();
  const tasks: Record<string, unknown>[] = [];
  const notes: string[][] = [];
  let skipped = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const task = cellText(get(row, "משימה"));
    const subject = cellText(get(row, "נושא כללי"));
    const title = task || subject;
    if (!title) return;
    if (seen.has(`${title}|${subject}`)) {
      skipped++;
      return;
    }
    seen.add(`${title}|${subject}`);

    const rawStatus = cellText(get(row, "סטטוס"));
    const status = STATUS_MAP[rawStatus];
    if (rawStatus && !status) unknown.add(rawStatus);

    const estRaw = get(row, "הערכת שעות");
    const est = cellNumber(estRaw);
    const billedRaw = get(row, "חויב");
    const lines = [
      ["הערות", cellText(get(row, "הערות"))],
      ["הערות לקוח", cellText(get(row, "הערות לקוח"))],
      ["סטטוס לקוח", cellText(get(row, "סטטוס לקוח"))],
      ["תעדוף", cellText(get(row, "תעדוף"))],
      ["גרסה", cellText(get(row, "גרסה"))],
      ["סטטוס מקורי", rawStatus === "חסום" ? rawStatus : ""],
      ["הערכת שעות (טקסט)", est == null ? cellText(estRaw) : ""],
      ["חויב", billedRaw instanceof Date ? cellText(billedRaw) : ""],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);

    tasks.push({
      title,
      subject: task ? subject : "",
      site_id: siteId,
      client_id: clientId,
      status: status ?? "pending_approval",
      estimated_hours: est,
      billed: cellText(billedRaw) !== "",
      created_by: me.id,
    });
    notes.push(lines);
  });

  if (!tasks.length) return { imported: 0, skipped };

  const { data: inserted, error } = await db.from("tasks").insert(tasks).select("id");
  if (error || !inserted) return { error: `הייבוא נכשל: ${error?.message ?? ""}` };

  // Insert order matches returned order; add a history entry (+ imported notes as a comment).
  const events = inserted.flatMap((t, i) => [
    { task_id: t.id, author_id: me.id, kind: "change", body: "המשימה יובאה מקובץ אקסל" },
    ...(notes[i].length
      ? [{ task_id: t.id, author_id: me.id, kind: "comment", body: `נתונים מהאקסל:\n${notes[i].join("\n")}` }]
      : []),
  ]);
  await db.from("task_events").insert(events);

  revalidatePath("/tasks");
  return { imported: inserted.length, skipped, unknownStatuses: [...unknown] };
}
