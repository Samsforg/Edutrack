import { requireRole } from "@/lib/auth/guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportStudentsForm } from "./import-form";

export default async function ImportPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId =
    session.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school_id ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import CSV — Élèves</h1>
        <p className="text-muted-foreground">
          Importez vos élèves depuis un fichier CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Format attendu</CardTitle>
          <CardDescription>
            Colonnes (séparateur virgule) :{" "}
            <code>matricule,prénom,nom,classe</code>. La classe doit déjà
            exister.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            {`matricule,prénom,nom,classe
ELEV-001,Amadou,Cissé,6ème A
ELEV-002,Aïcha,Ba,5ème A`}
          </pre>
        </CardContent>
      </Card>

      {schoolId ? (
        <ImportStudentsForm schoolId={schoolId} />
      ) : (
        <Card>
          <CardContent className="p-6">
            Aucun établissement administré.
          </CardContent>
        </Card>
      )}
    </div>
  );
}