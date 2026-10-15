import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUSES } from "@/lib/constants";
import { createTask } from "../../actions";

export default async function NewTaskPage() {
  const user = await requireUser();
  const db = createAdminClient();
  const [{ data: sites }, { data: clients }] = await Promise.all([
    db.from("sites").select("id, name").order("name"),
    user.role === "elad"
      ? db.from("profiles").select("id, full_name, username").eq("role", "client").order("username")
      : Promise.resolve({ data: [] as { id: string; full_name: string; username: string }[] }),
  ]);

  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-bold">משימה חדשה</h1>
      <form action={createTask} className="space-y-4">
        <div>
          <label className="label">כותרת</label>
          <input name="title" className="input" required autoFocus />
        </div>
        <div>
          <label className="label">נושא כללי</label>
          <input name="subject" className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">אתר</label>
            <select name="site_id" className="input" defaultValue="">
              <option value="">—</option>
              {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {user.role === "elad" && (
            <div>
              <label className="label">לקוח</label>
              <select name="client_id" className="input" required defaultValue="">
                <option value="" disabled>בחר לקוח</option>
                {clients?.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
              </select>
            </div>
          )}
        </div>
        {user.role === "elad" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">הערכת שעות</label>
              <input name="estimated_hours" type="number" step="0.25" min="0" className="input" />
            </div>
            <div>
              <label className="label">סטטוס</label>
              <select name="status" className="input" defaultValue="pending_approval">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}
        <button className="btn">יצירה</button>
      </form>
    </div>
  );
}
