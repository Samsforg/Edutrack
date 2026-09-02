import { requireRole } from "@/lib/auth/guard";
import { listAcademicYears } from "@/lib/db/academic-years";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AcademicYearFormButton } from "./academic-year-form";
import { AcademicYearActions } from "./academic-year-actions";

export default async function AcademicYearsPage() {
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

  const years = await listAcademicYears(schoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Années scolaires</h1>
          <p className="text-muted-foreground">
            {years.length} année(s) scolaire(s). Une seule peut être courante.
          </p>
        </div>
        <AcademicYearFormButton schoolId={schoolId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {years.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Créez votre première année scolaire.
            </CardContent>
          </Card>
        ) : (
          years.map((y) => (
            <Card key={y.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{y.name}</span>
                  {y.is_current && <Badge>Courante</Badge>}
                </CardTitle>
                <CardDescription>
                  {y.start_date} → {y.end_date}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {y.class_count} classe(s)
                </p>
                <AcademicYearActions year={y} schoolId={schoolId} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}