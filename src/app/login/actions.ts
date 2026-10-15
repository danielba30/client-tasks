"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function login(_prev: { error?: string }, formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "נא למלא שם משתמש וסיסמה" };

  // Username or email both work; resolve to the email Supabase Auth expects.
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("email")
      .ilike("username", identifier)
      .maybeSingle();
    if (!data) return { error: "שם משתמש או סיסמה שגויים" };
    email = data.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "שם משתמש או סיסמה שגויים" };
  redirect("/tasks");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
