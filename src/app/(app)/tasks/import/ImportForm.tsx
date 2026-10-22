"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importTasks, type ImportState } from "./actions";

export function ImportForm({
  sites,
}: {
  sites: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(importTasks, {} as ImportState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <div>
          <label className="label">אתר / לקוח (יוחל על כל המשימות בקובץ)</label>
          <select name="site_id" className="input" required defaultValue="">
            <option value="" disabled>בחר אתר</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">קובץ אקסל (.xlsx), נקרא הטאב הראשון בלבד</label>
        <input name="file" type="file" accept=".xlsx" className="input" required />
      </div>
      <button className="btn" disabled={pending}>{pending ? "מייבא…" : "ייבוא"}</button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.imported !== undefined && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          יובאו {state.imported} משימות
          {state.skipped ? `, דולגו ${state.skipped} שכבר קיימות` : ""}.{" "}
          <Link href="/tasks" className="underline">למשימות</Link>
          {!!state.unknownStatuses?.length && (
            <p className="mt-1 text-amber-800">
              סטטוסים לא מוכרים הוגדרו כסטטוס ברירת המחדל: {state.unknownStatuses.join(", ")}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
