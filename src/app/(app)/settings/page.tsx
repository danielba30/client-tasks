import { requireElad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_COLORS, roleLabel, statusClass, type Profile } from "@/lib/constants";
import { getStatuses } from "@/lib/statuses";
import { deleteAllTasks, setUserSites, addSite, addStatus, deleteSite, deleteStatus, deleteUser, renameSite, resetPassword, updateStatus } from "../actions";
import { NewUserForm } from "./NewUserForm";

export default async function SettingsPage() {
  const me = await requireElad();
  const db = createAdminClient();
  const [{ data: sites }, { data: users }, statuses, { data: usage }, { data: links }] = await Promise.all([
    db.from("sites").select("id, name").order("name"),
    db.from("profiles").select("id, username, email, full_name, role").order("created_at").returns<Profile[]>(),
    getStatuses(),
    db.from("tasks").select("status_id"),
    db.from("user_sites").select("user_id, site_id"),
  ]);
  const inUse = new Set((usage ?? []).map((t) => t.status_id));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">אתרים</h2>
        <form action={addSite} className="mb-4 flex gap-2">
          <input name="name" className="input" placeholder="שם אתר חדש" required />
          <button className="btn">הוספה</button>
        </form>
        <ul className="space-y-2">
          {sites?.map((s) => (
            <li key={s.id} className="flex gap-2">
              <form action={renameSite.bind(null, s.id)} className="flex flex-1 gap-2">
                <input name="name" defaultValue={s.name} className="input" />
                <button className="btn-ghost">שמירה</button>
              </form>
              <form action={deleteSite.bind(null, s.id)}>
                <button className="btn-ghost text-red-600">מחיקה</button>
              </form>
            </li>
          ))}
          {!sites?.length && <li className="text-sm text-gray-400">אין אתרים</li>}
        </ul>
        <p className="mt-3 text-xs text-gray-400">מחיקת אתר לא מוחקת משימות — הן יישארו ללא אתר.</p>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="mb-1 font-bold">סטטוסים</h2>
        <p className="mb-3 text-xs text-gray-500">
          ברירת מחדל: הסטטוס של משימות חדשות ושל משימות מיובאות. ממתין ללקוח: הלקוח יכול לשנות סטטוס של משימות שנמצאות בו.
          הלקוח יכול לבחור: הלקוח רשאי להעביר משימה לסטטוס הזה.
        </p>
        <ul className="space-y-3">
          {statuses.map((st) => (
            <li key={st.id} className="flex flex-wrap items-center gap-2">
              <form action={updateStatus.bind(null, st.id)} className="flex flex-wrap items-center gap-2">
                <input name="name" defaultValue={st.name} className="input !w-44" required />
                <select name="color" defaultValue={st.color} className="input !w-24">
                  {Object.entries(STATUS_COLORS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
                <input name="sort_order" type="number" defaultValue={st.sort_order} className="input !w-16" title="סדר" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_default" defaultChecked={st.is_default} />ברירת מחדל</label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="awaiting_client" defaultChecked={st.awaiting_client} />ממתין ללקוח</label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="client_selectable" defaultChecked={st.client_selectable} />הלקוח יכול לבחור</label>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(st.color)}`}>{st.name}</span>
                <button className="btn-ghost">שמירה</button>
              </form>
              {inUse.has(st.id) ? (
                <span className="text-xs text-gray-400">בשימוש, לא ניתן למחיקה</span>
              ) : (
                <form action={deleteStatus.bind(null, st.id)}>
                  <button className="btn-ghost text-red-600">מחיקה</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={addStatus} className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <input name="name" className="input !w-44" placeholder="סטטוס חדש" required />
          <select name="color" className="input !w-24" defaultValue="gray">
            {Object.entries(STATUS_COLORS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <input name="sort_order" type="number" defaultValue={statuses.length + 1} className="input !w-16" title="סדר" />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="awaiting_client" />ממתין ללקוח</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="client_selectable" />הלקוח יכול לבחור</label>
          <button className="btn">הוספה</button>
        </form>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="mb-3 font-bold">משתמשים</h2>
        <NewUserForm />
        <ul className="mt-5 divide-y">
          {users?.map((u) => (
            <li key={u.id} className="py-3 text-sm">
              <div className="flex items-center gap-2">
                <b>{u.full_name || u.username}</b>
                <span className="rounded bg-gray-100 px-1.5 text-xs">{roleLabel(u.role)}</span>
                <span className="text-xs text-gray-500" dir="ltr">{u.username} · {u.email}</span>
              </div>
              {u.role === "client" && (
                <form action={setUserSites.bind(null, u.id)} className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-gray-500">אתרים:</span>
                  {sites?.map((s) => (
                    <label key={s.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        name="site_ids"
                        value={s.id}
                        defaultChecked={links?.some((l) => l.user_id === u.id && l.site_id === s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                  <button className="btn-ghost">שמירת אתרים</button>
                </form>
              )}
              <div className="mt-2 flex gap-2">
                <form action={resetPassword.bind(null, u.id)} className="flex gap-2">
                  <input name="password" type="password" minLength={8} className="input !w-40" placeholder="סיסמה חדשה" />
                  <button className="btn-ghost">איפוס סיסמה</button>
                </form>
                {u.id !== me.id && (
                  <form action={deleteUser.bind(null, u.id)}>
                    <button className="btn-ghost text-red-600">מחיקה</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-red-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="mb-1 font-bold text-red-700">מחיקת כל המשימות</h2>
        <p className="mb-3 text-xs text-gray-500">
          מוחק את כל המשימות ({usage?.length ?? 0}) יחד עם ההתכתבות וההיסטוריה שלהן. אי אפשר לשחזר. אתרים, סטטוסים ומשתמשים לא נמחקים.
        </p>
        <form action={deleteAllTasks} className="flex flex-wrap items-center gap-2">
          <input name="confirm" className="input !w-48" placeholder='הקלד "מחק הכל"' autoComplete="off" required />
          <button className="btn-ghost text-red-600">מחיקת כל המשימות</button>
        </form>
      </section>
    </div>
  );
}
