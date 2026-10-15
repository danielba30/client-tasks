import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/tasks" className="font-bold">ניהול משימות</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/tasks" className="hover:underline">משימות</Link>
            {user.role === "elad" && <Link href="/settings" className="hover:underline">הגדרות</Link>}
          </nav>
          <div className="ms-auto flex items-center gap-3 text-sm text-gray-600">
            <span>{user.full_name || user.username} ({roleLabel(user.role)})</span>
            <form action={logout}><button className="btn-ghost">יציאה</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
