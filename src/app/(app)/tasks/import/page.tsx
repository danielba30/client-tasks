import { requireElad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  await requireElad();
  const db = createAdminClient();
  const [{ data: sites }] = await Promise.all([
    db.from("sites").select("id, name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-xl font-bold">ייבוא משימות מאקסל</h1>
      <p className="mb-4 text-sm text-gray-500">
        כותרות בשורה הראשונה: משימה, נושא כללי, סטטוס, הערכת שעות, חויב, הערות, הערות לקוח, סטטוס לקוח, תעדוף, גרסה.
        משימות שכבר קיימות (אותה כותרת ונושא, לאותו לקוח ואתר) מדולגות.
      </p>
      <ImportForm
        sites={sites ?? []}
      />
    </div>
  );
}
