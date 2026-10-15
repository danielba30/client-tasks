"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElad, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUSES, statusLabel, type Task } from "@/lib/constants";

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

  const clientId = user.role === "client" ? user.id : str(formData, "client_id");
  const row: Record<string, unknown> = {
    title,
    subject: str(formData, "subject"),
    site_id: num(formData, "site_id"),
    client_id: clientId,
    created_by: user.id,
  };
  if (user.role === "elad") {
    row.estimated_hours = num(formData, "estimated_hours");
    const status = str(formData, "status");
    if (STATUSES.some((s) => s.value === status)) row.status = status;
  }

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
  if (user.role === "client" && task.client_id !== user.id) return;

  const patch: Record<string, unknown> = {};
  const log: string[] = [];

  const newStatus = str(formData, "status");
  if (newStatus && newStatus !== task.status && STATUSES.some((s) => s.value === newStatus)) {
    // Clients may only approve a pending task or send a tested task back to work.
    const clientAllowed =
      (task.status === "pending_approval" && newStatus === "approved_waiting") ||
      (task.status === "client_testing" && newStatus === "in_progress");
    if (user.role === "elad" || clientAllowed) {
      patch.status = newStatus;
      log.push(`סטטוס: ${statusLabel(task.status)} ← ${statusLabel(newStatus)}`);
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
    const { data } = await db.from("tasks").select("client_id").eq("id", taskId).single();
    if (data?.client_id !== user.id) return;
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
