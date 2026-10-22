import { createAdminClient } from "@/lib/supabase/admin";
import type { Status } from "@/lib/constants";

export async function getStatuses(): Promise<Status[]> {
  const { data } = await createAdminClient()
    .from("statuses")
    .select("*")
    .order("sort_order")
    .order("id")
    .returns<Status[]>();
  return data ?? [];
}
