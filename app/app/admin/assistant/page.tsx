import { requireRole } from "@/lib/auth/guard";
import { AssistantChat } from "./assistant-chat";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireRole(["SCHOOL_ADMIN"]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assistant EduTrack</h1>
        <p className="text-muted-foreground">
          Répond uniquement à partir des données de votre école, dans un périmètre
          strictement limité.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Posez une question</CardTitle>
          <CardDescription>
            L&apos;assistant ne voit jamais les données d&apos;autres établissements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssistantChat />
        </CardContent>
      </Card>
    </div>
  );
}
