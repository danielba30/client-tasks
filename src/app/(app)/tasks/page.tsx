import Link from "next/link";
import { getUserSiteIds, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusClass, type Task } from "@/lib/constants";
import { getStatuses } from "@/lib/statuses";

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

  const [{ data: tasks }, { data: sites }, statuses] = await Promise.all([
    q.returns<Task[]>(),
    db.from("sites").select("id, name").order("name"),
    getStatuses(),
  ]);

  const siteName = (id: number | null) => sites?.find((s) => s.id === id)?.name ?? "—";
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

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-start text-xs text-gray-500">
            <tr>
              <th className="p-3 text-start">#</th>
              <th className="p-3 text-start">כותרת</th>
              <th className="p-3 text-start">נושא</th>
              <th className="p-3 text-start">אתר / לקוח</th>
              <th className="p-3 text-start">סטטוס</th>
              <th className="p-3 text-start">הערכה</th>
              <th className="p-3 text-start">בפועל</th>
              <th className="p-3 text-start">חויב</th>
            </tr>
          </thead>
          <tbody>
            {tasks?.map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 text-gray-400">{t.id}</td>
                <td className="p-3 font-medium">
                  <Link href={`/tasks/${t.id}`} className="text-indigo-700 hover:underline">{t.title}</Link>
                </td>
                <td className="p-3">{t.subject}</td>
                <td className="p-3">{siteName(t.site_id)}</td>
                <td className="p-3">
                  {(() => {
                    const st = statuses.find((s) => s.id === t.status_id);
                    return <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(st?.color ?? "gray")}`}>{st?.name ?? "—"}</span>;
                  })()}
                </td>
                <td className="p-3">{t.estimated_hours ?? "—"}</td>
                <td className="p-3">{t.actual_hours ?? "—"}</td>
                <td className="p-3">{t.billed ? "כן" : "לא"}</td>
              </tr>
            ))}
            {!tasks?.length && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">אין משימות</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
