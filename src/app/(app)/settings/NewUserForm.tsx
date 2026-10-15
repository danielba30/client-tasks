"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUser } from "../actions";

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUser, {} as { error?: string; ok?: boolean });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="full_name" className="input" placeholder="שם מלא" />
      <input name="username" className="input" placeholder="שם משתמש" required dir="ltr" />
      <input name="email" type="email" className="input" placeholder="מייל" required dir="ltr" />
      <input name="password" type="password" minLength={8} className="input" placeholder="סיסמה (8+ תווים)" required dir="ltr" />
      <select name="role" className="input" defaultValue="client">
        <option value="client">לקוח</option>
        <option value="elad">אלעד</option>
      </select>
      <button className="btn" disabled={pending}>{pending ? "יוצר…" : "יצירת משתמש"}</button>
      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700 sm:col-span-2">המשתמש נוצר</p>}
    </form>
  );
}
