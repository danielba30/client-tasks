import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUSES, statusColor, statusLabel, type Task } from "@/lib/constants";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string; client?: string }>;
}) {
  const user = await requireUser();
  const { status, site, client } = await searchParams;
  const db = createAdminClient();

  let q = db.from("tasks").select("*").order("updated_at", { ascending: false });
  if (user.role === "client") q = q.eq("client_id", user.id);
  else if (client) q = q.eq("client_id", client);
  if (status) q = q.eq("status", status);
  if (site) q = q.eq("site_id", Number(site));

  const [{ data: tasks }, { data: sites }, { data: clients }] = await Promise.all([
    q.returns<Task[]>(),
    db.from("sites").select("id, name").order("name"),
    user.role === "elad"
      ? db.from("profiles").select("id, full_name, username").eq("role", "client").order("username")
      : Promise.resolve({ data: [] as { id: string; full_name: string; username: string }[] }),
  ]);

  const siteName = (id: number | null) => sites?.find((s) => s.id === id)?.name ?? "—";
  const clientName = (id: string) => {
    const c = clients?.find((c) => c.id === id);
    return c ? c.full_name || c.username : "";
  };

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
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select name="site" defaultValue={site ?? ""} className="input !w-auto">
          <option value="">כל האתרים</option>
          {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {user.role === "elad" && (
          <select name="client" defaultValue={client ?? ""} className="input !w-auto">
            <option value="">כל הלקוחות</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
          </select>
        )}
        <button className="btn-ghost">סינון</button>
      </form>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-start text-xs text-gray-500">
            <tr>
              <th className="p-3 text-start">#</th>
              <th className="p-3 text-start">כותרת</th>
              <th className="p-3 text-start">נושא</th>
              <th className="p-3 text-start">אתר</th>
              {user.role === "elad" && <th className="p-3 text-start">לקוח</th>}
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
                {user.role === "elad" && <td className="p-3">{clientName(t.client_id)}</td>}
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                </td>
                <td className="p-3">{t.estimated_hours ?? "—"}</td>
                <td className="p-3">{t.actual_hours ?? "—"}</td>
                <td className="p-3">{t.billed ? "כן" : "לא"}</td>
              </tr>
            ))}
            {!tasks?.length && (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">אין משימות</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
