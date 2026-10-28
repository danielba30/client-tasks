"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { statusClass, type Status, type Task } from "@/lib/constants";
import { deleteTasks, quickUpdateTask, type QuickPatch } from "../actions";

export function TaskTable({
  initialTasks,
  statuses,
  siteNames,
  notes,
  isElad,
}: {
  initialTasks: Task[];
  statuses: Status[];
  siteNames: Record<number, string>;
  notes: Record<number, string>;
  isElad: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // Re-sync when the server sends a new list (filters, deletes).
  const [prev, setPrev] = useState(initialTasks);
  if (prev !== initialTasks) {
    setPrev(initialTasks);
    setTasks(initialTasks);
    setSelected(new Set());
  }

  const save = (id: number, patch: QuickPatch) => {
    const before = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setError("");
    start(async () => {
      const res = await quickUpdateTask(id, patch);
      if (res.error) {
        setTasks(before);
        setError(res.error);
      }
    });
  };

  const hours = (id: number, key: "estimated_hours" | "actual_hours", raw: string, current: number | null) => {
    const v = raw.trim() === "" ? null : Number(raw);
    if (v !== current) save(id, { [key]: v });
  };

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const remove = () => {
    if (!confirm(`למחוק ${selected.size} משימות? אי אפשר לשחזר.`)) return;
    start(async () => {
      const res = await deleteTasks([...selected]);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div>
      {isElad && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md bg-red-50 p-2 text-sm">
          <span>{selected.size} נבחרו</span>
          <button className="btn-ghost text-red-600" onClick={remove} disabled={pending}>מחיקת הנבחרות</button>
          <button className="btn-ghost" onClick={() => setSelected(new Set())}>ביטול בחירה</button>
        </div>
      )}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full min-w-[1100px] table-fixed text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500">
            <tr>
              {isElad && (
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(tasks.map((t) => t.id)))}
                    aria-label="בחירת הכל"
                  />
                </th>
              )}
              <th className="w-14 p-3 text-start">#</th>
              <th className="w-[22%] p-3 text-start">כותרת</th>
              <th className="w-[12%] p-3 text-start">נושא</th>
              <th className="w-24 p-3 text-start">אתר / לקוח</th>
              <th className="w-40 p-3 text-start">סטטוס</th>
              <th className="w-24 p-3 text-start">הערכה</th>
              <th className="w-24 p-3 text-start">בפועל</th>
              <th className="w-16 p-3 text-start">חויב</th>
              <th className="p-3 text-start">הערות ונתונים נוספים</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const current = statuses.find((s) => s.id === t.status_id);
              const options = statuses.filter(
                (s) => isElad || s.id === t.status_id || (current?.awaiting_client && s.client_selectable),
              );
              return (
                <tr key={t.id} className="border-b align-top last:border-0 hover:bg-gray-50">
                  {isElad && (
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                  )}
                  <td className="p-3 text-gray-400">{t.id}</td>
                  <td className="break-words p-3 font-medium">
                    <Link href={`/tasks/${t.id}`} className="text-indigo-700 hover:underline">{t.title}</Link>
                  </td>
                  <td className="break-words p-3">{t.subject}</td>
                  <td className="p-3">{t.site_id ? siteNames[t.site_id] ?? "—" : "—"}</td>
                  <td className="p-3">
                    {options.length > 1 ? (
                      <select
                        value={t.status_id}
                        onChange={(e) => save(t.id, { status_id: Number(e.target.value) })}
                        className={`rounded-full border-0 px-2 py-0.5 text-xs ${statusClass(current?.color ?? "gray")}`}
                      >
                        {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(current?.color ?? "gray")}`}>{current?.name ?? "—"}</span>
                    )}
                  </td>
                  {(["estimated_hours", "actual_hours"] as const).map((key) => (
                    <td key={key} className="p-3">
                      {isElad ? (
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={t[key] ?? ""}
                          onBlur={(e) => hours(t.id, key, e.target.value, t[key])}
                          className="input !w-20 !py-1"
                        />
                      ) : (
                        (t[key] ?? "—")
                      )}
                    </td>
                  ))}
                  <td className="p-3">
                    {isElad ? (
                      <input type="checkbox" checked={t.billed} onChange={(e) => save(t.id, { billed: e.target.checked })} />
                    ) : t.billed ? "כן" : "לא"}
                  </td>
                  <td className="whitespace-pre-wrap break-words p-3 text-xs text-gray-600">{notes[t.id] ?? ""}</td>
                </tr>
              );
            })}
            {!tasks.length && (
              <tr><td colSpan={isElad ? 10 : 9} className="p-8 text-center text-gray-400">אין משימות</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
