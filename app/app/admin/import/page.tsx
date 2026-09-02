import { requireRole } from "@/lib/auth/guard";
import { ImportWizard } from "./import-wizard";
import { ImportHistory } from "./import-history";

export default async function ImportPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId =
    session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Import CSV</h1>
        <p className="text-muted-foreground">
          Importez masse vos élèves, enseignants, parents, classes et matières.
          Chaque import est prévisualisé avant insertion, puis tracé dans
          l&apos;historique.
        </p>
      </div>

      {schoolId ? (
        <ImportWizard schoolId={schoolId} />
      ) : (
        <p className="text-muted-foreground">Aucun établissement administré.</p>
      )}

      <ImportHistory schoolId={schoolId} />
    </div>
  );
}
