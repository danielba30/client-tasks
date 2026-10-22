import { getUserSiteIds, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStatuses } from "@/lib/statuses";
import { createTask } from "../../actions";

export default async function NewTaskPage() {
  const user = await requireUser();
  const db = createAdminClient();
  const [{ data: allSites }, statuses, mySiteIds] = await Promise.all([
    db.from("sites").select("id, name").order("name"),
    getStatuses(),
    user.role === "client" ? getUserSiteIds(user.id) : Promise.resolve(null),
  ]);
  const sites = mySiteIds ? allSites?.filter((s) => mySiteIds.includes(s.id)) : allSites;

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
        <div>
          <label className="label">אתר / לקוח</label>
          <select name="site_id" className="input" required defaultValue="">
            <option value="" disabled>בחר אתר</option>
            {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {user.role === "elad" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">הערכת שעות</label>
              <input name="estimated_hours" type="number" step="0.25" min="0" className="input" />
            </div>
            <div>
              <label className="label">סטטוס</label>
              <select name="status_id" className="input" defaultValue={statuses.find((s) => s.is_default)?.id}>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <button className="btn">יצירה</button>
      </form>
    </div>
  );
}
