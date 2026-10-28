import Link from "next/link";
import { getUserSiteIds, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Task } from "@/lib/constants";
import { getStatuses } from "@/lib/statuses";
import { TaskTable } from "./TaskTable";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string }>;
}) {
  const user = await requireUser();
  const { status, site } = await searchParams;
  const db = createAdminClient();

  let q = db.from("tasks").select("*").order("updated_at", { ascending: false });
  if (user.role === "client") q = q.in("site_id", [0, ...(await getUserSiteIds(user.id))]);
  if (status) q = q.eq("status_id", Number(status));
  if (site) q = q.eq("site_id", Number(site));

  const [{ data: tasks }, { data: sites }, statuses, { data: noteEvents }] = await Promise.all([
    q.returns<Task[]>(),
    db.from("sites").select("id, name").order("name"),
    getStatuses(),
    // Extra Excel columns (notes, client notes, version...) imported as the first comment of a task.
    db.from("task_events").select("task_id, body").eq("kind", "comment").like("body", "נתונים מהאקסל:%"),
  ]);
  const notes: Record<number, string> = {};
  for (const e of noteEvents ?? []) notes[e.task_id] = e.body.replace(/^נתונים מהאקסל:\n?/, "");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">משימות</h1>
        {user.role === "elad" && <Link href="/tasks/import" className="btn-ghost ms-auto">ייבוא מאקסל</Link>}
        <Link href="/tasks/new" className={user.role === "elad" ? "btn" : "btn ms-auto"}>+ משימה חדשה</Link>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} className="input !w-auto">
          <option value="">כל הסטטוסים</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="site" defaultValue={site ?? ""} className="input !w-auto">
          <option value="">כל האתרים</option>
          {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn-ghost">סינון</button>
      </form>

      <TaskTable
        initialTasks={tasks ?? []}
        statuses={statuses}
        siteNames={Object.fromEntries((sites ?? []).map((s) => [s.id, s.name]))}
        notes={notes}
        isElad={user.role === "elad"}
      />
    </div>
  );
}
