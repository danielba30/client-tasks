"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {} as { error?: string });
  return (
    <main className="mx-auto mt-24 w-full max-w-sm rounded-xl bg-white p-8 shadow">
      <h1 className="mb-6 text-center text-xl font-bold">ניהול משימות</h1>
      <form action={action} className="space-y-4">
        <div>
          <label className="label">שם משתמש או מייל</label>
          <input name="identifier" className="input" autoComplete="username" autoFocus required />
        </div>
        <div>
          <label className="label">סיסמה</label>
          <input name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "מתחבר…" : "התחברות"}</button>
      </form>
    </main>
  );
}
