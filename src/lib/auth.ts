import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/constants";

export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id, username, email, full_name, role")
    .eq("id", data.user.id)
    .single();
  return (profile as Profile) ?? null;
});

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireElad(): Promise<Profile> {
  const user = await requireUser();
  if (user.role !== "elad") redirect("/tasks");
  return user;
}
