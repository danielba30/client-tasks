import { requireElad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleLabel, type Profile } from "@/lib/constants";
import { addSite, deleteSite, deleteUser, renameSite, resetPassword } from "../actions";
import { NewUserForm } from "./NewUserForm";

export default async function SettingsPage() {
  const me = await requireElad();
  const db = createAdminClient();
  const [{ data: sites }, { data: users }] = await Promise.all([
    db.from("sites").select("id, name").order("name"),
    db.from("profiles").select("id, username, email, full_name, role").order("created_at").returns<Profile[]>(),
  ]);

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

      <section className="rounded-lg bg-white p-5 shadow-sm">
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
    </div>
  );
}
