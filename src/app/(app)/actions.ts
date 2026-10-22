"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserSiteIds, requireElad, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStatuses } from "@/lib/statuses";
import type { Task } from "@/lib/constants";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === "" ? null : Number(v);
};

// ---------- Tasks ----------

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const db = createAdminClient();
  const title = str(formData, "title");
  if (!title) return;

  const siteId = num(formData, "site_id");
  if (user.role === "client" && (!siteId || !(await getUserSiteIds(user.id)).includes(siteId))) return;
  const row: Record<string, unknown> = {
    title,
    subject: str(formData, "subject"),
    site_id: siteId,
    created_by: user.id,
  };
  const statuses = await getStatuses();
  const chosen = user.role === "elad" ? statuses.find((s) => s.id === num(formData, "status_id")) : undefined;
  const initial = chosen ?? statuses.find((s) => s.is_default) ?? statuses[0];
  if (!initial) throw new Error("לא הוגדרו סטטוסים");
  row.status_id = initial.id;
  if (user.role === "elad") row.estimated_hours = num(formData, "estimated_hours");

  const { data, error } = await db.from("tasks").insert(row).select("id").single();
  if (error || !data) throw new Error("יצירת המשימה נכשלה");
  await db.from("task_events").insert({
    task_id: data.id,
    author_id: user.id,
    kind: "change",
    body: "המשימה נוצרה",
  });
  redirect(`/tasks/${data.id}`);
}

export async function updateTask(taskId: number, formData: FormData) {
  const user = await requireUser();
  const db = createAdminClient();
  const { data: task } = await db.from("tasks").select("*").eq("id", taskId).single<Task>();
  if (!task) return;
  if (user.role === "client" && !(task.site_id && (await getUserSiteIds(user.id)).includes(task.site_id))) return;

  const patch: Record<string, unknown> = {};
  const log: string[] = [];

  const newStatusId = num(formData, "status_id");
  if (newStatusId && newStatusId !== task.status_id) {
    const statuses = await getStatuses();
    const from = statuses.find((s) => s.id === task.status_id);
    const to = statuses.find((s) => s.id === newStatusId);
    // Clients may only move tasks that await them, into statuses flagged as client-selectable.
    if (to && (user.role === "elad" || (from?.awaiting_client && to.client_selectable))) {
      patch.status_id = to.id;
      log.push(`סטטוס: ${from?.name ?? "—"} ← ${to.name}`);
    }
  }

  if (user.role === "elad") {
    const title = str(formData, "title");
    if (title && title !== task.title) {
      patch.title = title;
      log.push(`כותרת: "${task.title}" ← "${title}"`);
    }
    const subject = str(formData, "subject");
    if (subject !== task.subject) {
      patch.subject = subject;
      log.push(`נושא: "${task.subject}" ← "${subject}"`);
    }
    const siteId = num(formData, "site_id");
    if (siteId !== task.site_id) {
      patch.site_id = siteId;
      const { data: sites } = await db.from("sites").select("id, name");
      const name = (id: number | null) => sites?.find((s) => s.id === id)?.name ?? "—";
      log.push(`אתר: ${name(task.site_id)} ← ${name(siteId)}`);
    }
    const est = num(formData, "estimated_hours");
    if (est !== task.estimated_hours) {
      patch.estimated_hours = est;
      log.push(`הערכת שעות: ${task.estimated_hours ?? "—"} ← ${est ?? "—"}`);
    }
    const act = num(formData, "actual_hours");
    if (act !== task.actual_hours) {
      patch.actual_hours = act;
      log.push(`שעות בפועל: ${task.actual_hours ?? "—"} ← ${act ?? "—"}`);
    }
    const billed = formData.get("billed") === "on";
    if (billed !== task.billed) {
      patch.billed = billed;
      log.push(billed ? "סומן כמחויב" : "סומן כלא מחויב");
    }
  }

  if (log.length) {
    patch.updated_at = new Date().toISOString();
    await db.from("tasks").update(patch).eq("id", taskId);
    await db.from("task_events").insert(
      log.map((body) => ({ task_id: taskId, author_id: user.id, kind: "change", body })),
    );
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}

export async function deleteTask(taskId: number) {
  await requireElad();
  await createAdminClient().from("tasks").delete().eq("id", taskId);
  redirect("/tasks");
}

export async function addComment(taskId: number, formData: FormData) {
  const user = await requireUser();
  const body = str(formData, "body");
  if (!body) return;
  const db = createAdminClient();
  if (user.role === "client") {
    const { data } = await db.from("tasks").select("site_id").eq("id", taskId).single();
    if (!data?.site_id || !(await getUserSiteIds(user.id)).includes(data.site_id)) return;
  }
  await db.from("task_events").insert({ task_id: taskId, author_id: user.id, kind: "comment", body });
  await db.from("tasks").update({ updated_at: new Date().toISOString() }).eq("id", taskId);
  revalidatePath(`/tasks/${taskId}`);
}

// ---------- Settings (Elad only) ----------

export async function addSite(formData: FormData) {
  await requireElad();
  const name = str(formData, "name");
  if (name) await createAdminClient().from("sites").insert({ name });
  revalidatePath("/settings");
}

export async function renameSite(id: number, formData: FormData) {
  await requireElad();
  const name = str(formData, "name");
  if (name) await createAdminClient().from("sites").update({ name }).eq("id", id);
  revalidatePath("/settings");
}

export async function deleteSite(id: number) {
  await requireElad();
  await createAdminClient().from("sites").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function createUser(_prev: { error?: string; ok?: boolean }, formData: FormData) {
  await requireElad();
  const username = str(formData, "username");
  const email = str(formData, "email");
  const password = String(formData.get("password") ?? "");
  const full_name = str(formData, "full_name");
  const role = str(formData, "role") === "elad" ? "elad" : "client";
  if (!username || !email || password.length < 8) {
    return { error: "נא למלא שם משתמש, מייל וסיסמה (לפחות 8 תווים)" };
  }

  const db = createAdminClient();
  const { data: taken } = await db.from("profiles").select("id").ilike("username", username).maybeSingle();
  if (taken) return { error: "שם המשתמש כבר קיים" };

  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: `יצירת המשתמש נכשלה: ${error?.message ?? ""}` };

  const { error: pErr } = await db
    .from("profiles")
    .insert({ id: data.user.id, username, email, full_name, role });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id);
    return { error: `יצירת המשתמש נכשלה: ${pErr.message}` };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetPassword(userId: string, formData: FormData) {
  await requireElad();
  const password = String(formData.get("password") ?? "");
  if (password.length >= 8) await createAdminClient().auth.admin.updateUserById(userId, { password });
  revalidatePath("/settings");
}

export async function deleteUser(userId: string) {
  const me = await requireElad();
  if (userId === me.id) return;
  await createAdminClient().auth.admin.deleteUser(userId); // profile + tasks cascade
  revalidatePath("/settings");
}

// ---------- Statuses (Elad only) ----------

const statusFields = (formData: FormData) => ({
  name: str(formData, "name"),
  color: str(formData, "color") || "gray",
  sort_order: num(formData, "sort_order") ?? 0,
  is_default: formData.get("is_default") === "on",
  awaiting_client: formData.get("awaiting_client") === "on",
  client_selectable: formData.get("client_selectable") === "on",
});

// At most one default status; clear the flag elsewhere when a new one is set.
async function clearOtherDefaults(exceptId: number) {
  await createAdminClient().from("statuses").update({ is_default: false }).neq("id", exceptId);
}

export async function addStatus(formData: FormData) {
  await requireElad();
  const fields = statusFields(formData);
  if (!fields.name) return;
  const { data } = await createAdminClient().from("statuses").insert(fields).select("id").single();
  if (data && fields.is_default) await clearOtherDefaults(data.id);
  revalidatePath("/settings");
}

export async function updateStatus(id: number, formData: FormData) {
  await requireElad();
  const fields = statusFields(formData);
  if (!fields.name) return;
  await createAdminClient().from("statuses").update(fields).eq("id", id);
  if (fields.is_default) await clearOtherDefaults(id);
  revalidatePath("/settings");
  revalidatePath("/tasks");
}

export async function deleteStatus(id: number) {
  await requireElad();
  // Restricted by FK: fails (and is ignored) while any task still uses the status.
  await createAdminClient().from("statuses").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function setUserSites(userId: string, formData: FormData) {
  await requireElad();
  const db = createAdminClient();
  const siteIds = formData.getAll("site_ids").map(Number).filter(Boolean);
  await db.from("user_sites").delete().eq("user_id", userId);
  if (siteIds.length) await db.from("user_sites").insert(siteIds.map((site_id) => ({ user_id: userId, site_id })));
  revalidatePath("/settings");
}

// Wipes every task (and, by cascade, its history and messages). Requires typing the confirmation word.
export async function deleteAllTasks(formData: FormData) {
  await requireElad();
  if (str(formData, "confirm") !== "מחק הכל") return;
  await createAdminClient().from("tasks").delete().gt("id", 0);
  revalidatePath("/tasks");
  revalidatePath("/settings");
}

// ---------- Inline edits from the task list ----------

export interface QuickPatch {
  status_id?: number;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  billed?: boolean;
}

export async function quickUpdateTask(taskId: number, input: QuickPatch): Promise<{ error?: string }> {
  const user = await requireUser();
  const db = createAdminClient();
  const { data: task } = await db.from("tasks").select("*").eq("id", taskId).single<Task>();
  if (!task) return { error: "המשימה לא נמצאה" };
  if (user.role === "client" && !(task.site_id && (await getUserSiteIds(user.id)).includes(task.site_id))) {
    return { error: "אין הרשאה" };
  }

  const patch: Record<string, unknown> = {};
  const log: string[] = [];

  if (input.status_id !== undefined && input.status_id !== task.status_id) {
    const statuses = await getStatuses();
    const from = statuses.find((s) => s.id === task.status_id);
    const to = statuses.find((s) => s.id === input.status_id);
    if (!to || !(user.role === "elad" || (from?.awaiting_client && to.client_selectable))) {
      return { error: "אין הרשאה לשנות לסטטוס הזה" };
    }
    patch.status_id = to.id;
    log.push(`סטטוס: ${from?.name ?? "—"} ← ${to.name}`);
  }

  if (user.role === "elad") {
    const hours = (v: number | null | undefined) => (v == null || Number.isNaN(v) || v < 0 ? null : v);
    if (input.estimated_hours !== undefined && hours(input.estimated_hours) !== task.estimated_hours) {
      patch.estimated_hours = hours(input.estimated_hours);
      log.push(`הערכת שעות: ${task.estimated_hours ?? "—"} ← ${patch.estimated_hours ?? "—"}`);
    }
    if (input.actual_hours !== undefined && hours(input.actual_hours) !== task.actual_hours) {
      patch.actual_hours = hours(input.actual_hours);
      log.push(`שעות בפועל: ${task.actual_hours ?? "—"} ← ${patch.actual_hours ?? "—"}`);
    }
    if (input.billed !== undefined && input.billed !== task.billed) {
      patch.billed = input.billed;
      log.push(input.billed ? "סומן כמחויב" : "סומן כלא מחויב");
    }
  } else if (input.estimated_hours !== undefined || input.actual_hours !== undefined || input.billed !== undefined) {
    return { error: "אין הרשאה" };
  }

  if (log.length) {
    patch.updated_at = new Date().toISOString();
    await db.from("tasks").update(patch).eq("id", taskId);
    await db.from("task_events").insert(log.map((body) => ({ task_id: taskId, author_id: user.id, kind: "change", body })));
  }
  return {};
}

export async function deleteTasks(ids: number[]): Promise<{ error?: string }> {
  await requireElad();
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0);
  if (!clean.length) return {};
  const { error } = await createAdminClient().from("tasks").delete().in("id", clean);
  if (error) return { error: "המחיקה נכשלה" };
  revalidatePath("/tasks");
  return {};
}
