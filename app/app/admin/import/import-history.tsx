import { getImportHistory } from "@/lib/actions/import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type Job = Database["public"]["Tables"]["import_jobs"]["Row"];

const TYPE_LABEL: Record<string, string> = {
  students: "Élèves",
  parents: "Parents",
  teachers: "Enseignants",
  classes: "Classes",
  subjects: "Matières",
};

export async function ImportHistory({ schoolId }: { schoolId: string }) {
  const jobs = (await getImportHistory(schoolId)) as Job[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historique des imports</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun import pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2">Type</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Importés</th>
                  <th className="p-2">Erreurs</th>
                  <th className="p-2">Fichier</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t">
                    <td className="p-2">{TYPE_LABEL[j.type] ?? j.type}</td>
                    <td className="p-2">
                      <Badge variant={j.error_rows > 0 ? "destructive" : "secondary"}>
                        {j.status}
                      </Badge>
                    </td>
                    <td className="p-2">{j.total_rows}</td>
                    <td className="p-2 text-emerald-600">{j.success_rows}</td>
                    <td className="p-2 text-destructive">{j.error_rows}</td>
                    <td className="p-2 truncate max-w-[160px]">{j.file_name ?? "—"}</td>
                    <td className="p-2 whitespace-nowrap">
                      {new Date(j.created_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
