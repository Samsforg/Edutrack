import { requireRole } from "@/lib/auth/guard";
import { listParentsDetail } from "@/lib/db/parents";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParentFormButton } from "./parent-form";

export default async function ParentsPage() {
  const session = await requireRole(["SCHOOL_ADMIN"]);
  const schoolId = session.memberships.find(
    (m) => m.role === "SCHOOL_ADMIN"
  )?.school_id;

  if (!schoolId) {
    return (
      <Card>
        <CardContent className="p-6">Aucun établissement.</CardContent>
      </Card>
    );
  }

  const parents = await listParentsDetail(schoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Parents</h1>
          <p className="text-muted-foreground">
            {parents.length} parent(s) dans le répertoire de l’établissement.
          </p>
        </div>
        <ParentFormButton schoolId={schoolId} />
      </div>

      <Card>
        <CardContent className="p-0">
          {parents.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun parent. Ajoutez votre premier parent.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Enfants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parents.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.last_name} {p.first_name}
                    </TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.children.length === 0
                        ? "Aucun enfant lié"
                        : p.children.join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}