import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserSiteIds, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleLabel, statusClass, type Role, type Task } from "@/lib/constants";
import { getStatuses } from "@/lib/statuses";
import { addComment, deleteTask, updateTask } from "../../actions";

interface TaskEvent {
  id: number;
  author_id: string | null;
  kind: "comment" | "change";
  body: string;
  created_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" });

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) notFound();

  const db = createAdminClient();
  const { data: task } = await db.from("tasks").select("*").eq("id", taskId).single<Task>();
  if (!task) notFound();
  if (user.role === "client" && !(task.site_id && (await getUserSiteIds(user.id)).includes(task.site_id))) notFound();

  const [{ data: sites }, { data: events }, { data: people }, statuses] = await Promise.all([
    db.from("sites").select("id, name").order("name"),
    db.from("task_events").select("*").eq("task_id", taskId).order("created_at").returns<TaskEvent[]>(),
    db.from("profiles").select("id, full_name, username, role"),
    getStatuses(),
  ]);
  const who = (aid: string | null) => {
    const p = people?.find((p) => p.id === aid);
    return p ? `${p.full_name || p.username} (${roleLabel(p.role as Role)})` : "משתמש שנמחק";
  };

  const isElad = user.role === "elad";
  const showHistory = tab === "history";
  const items = events?.filter((e) => (showHistory ? e.kind === "change" : e.kind === "comment")) ?? [];

  // Statuses this user may move the task to (current one always included).
  const current = statuses.find((s) => s.id === task.status_id);
  const allowed = statuses.filter(
    (s) => isElad || s.id === task.status_id || (current?.awaiting_client && s.client_selectable),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <Link href="/tasks" className="text-xs text-gray-500 hover:underline">→ חזרה לרשימה</Link>
        <h1 className="mb-1 mt-2 text-lg font-bold">#{task.id} {task.title}</h1>
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
          <span className={`rounded-full px-2 py-0.5 ${statusClass(current?.color ?? "gray")}`}>{current?.name ?? "—"}</span>
        </div>

        <form action={updateTask.bind(null, taskId)} className="space-y-3">
          <div>
            <label className="label">כותרת</label>
            <input name="title" defaultValue={task.title} className="input" disabled={!isElad} />
          </div>
          <div>
            <label className="label">נושא כללי</label>
            <input name="subject" defaultValue={task.subject} className="input" disabled={!isElad} />
          </div>
          <div>
            <label className="label">אתר</label>
            <select name="site_id" defaultValue={task.site_id ?? ""} className="input" disabled={!isElad}>
              <option value="">—</option>
              {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">סטטוס</label>
            <select name="status_id" defaultValue={task.status_id} className="input" disabled={allowed.length < 2}>
              {allowed.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">הערכת שעות</label>
              <input name="estimated_hours" type="number" step="0.25" min="0" defaultValue={task.estimated_hours ?? ""} className="input" disabled={!isElad} />
            </div>
            <div>
              <label className="label">שעות בפועל</label>
              <input name="actual_hours" type="number" step="0.25" min="0" defaultValue={task.actual_hours ?? ""} className="input" disabled={!isElad} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="billed" defaultChecked={task.billed} disabled={!isElad} />
            חויב
          </label>
          {(isElad || allowed.length > 1) && <button className="btn w-full">שמירה</button>}
        </form>

        {isElad && (
          <form action={deleteTask.bind(null, taskId)} className="mt-4">
            <button className="text-xs text-red-600 hover:underline">מחיקת משימה</button>
          </form>
        )}
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-1 border-b">
          <Link
            href={`/tasks/${taskId}`}
            className={`px-4 py-2 text-sm ${!showHistory ? "border-b-2 border-indigo-600 font-medium" : "text-gray-500"}`}
          >
            התכתבות
          </Link>
          <Link
            href={`/tasks/${taskId}?tab=history`}
            className={`px-4 py-2 text-sm ${showHistory ? "border-b-2 border-indigo-600 font-medium" : "text-gray-500"}`}
          >
            היסטוריה
          </Link>
        </div>

        <ul className="space-y-3">
          {items.map((e) =>
            showHistory ? (
              <li key={e.id} className="flex gap-3 border-b pb-2 text-sm last:border-0">
                <span className="w-32 shrink-0 text-xs text-gray-400">{fmt(e.created_at)}</span>
                <span><b>{who(e.author_id)}</b> — {e.body}</span>
              </li>
            ) : (
              <li
                key={e.id}
                className={`max-w-[85%] rounded-lg p-3 text-sm ${e.author_id === user.id ? "bg-indigo-50" : "bg-gray-100 ms-auto"}`}
              >
                <div className="mb-1 text-xs text-gray-500">{who(e.author_id)} · {fmt(e.created_at)}</div>
                <p className="whitespace-pre-wrap">{e.body}</p>
              </li>
            ),
          )}
          {!items.length && <li className="py-8 text-center text-sm text-gray-400">{showHistory ? "אין היסטוריה" : "אין הודעות עדיין"}</li>}
        </ul>

        {!showHistory && (
          <form action={addComment.bind(null, taskId)} className="mt-4 flex gap-2">
            <textarea name="body" rows={2} className="input" placeholder="כתוב הודעה…" required />
            <button className="btn self-end">שליחה</button>
          </form>
        )}
      </section>
    </div>
  );
}
