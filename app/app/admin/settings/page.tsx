import { requireRole } from "@/lib/auth/guard";
import { getSchoolProfile } from "@/lib/db/school";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SchoolSettingsForm } from "./settings-form";

export default async function SettingsPage() {
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

  const school = await getSchoolProfile(schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de l’établissement</h1>
        <p className="text-muted-foreground">
          Coordonnées et informations publiques de l’école.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>
            Modifiez les coordonnées de votre établissement. Le code
            d’identification reste immuable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchoolSettingsForm
            schoolId={schoolId}
            school={school}
          />
        </CardContent>
      </Card>
    </div>
  );
}