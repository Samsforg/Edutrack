import { requireRole } from "@/lib/auth/guard";
import { listLeads } from "@/lib/db/saas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatusSelect } from "./lead-status-select";

const STATUS_VARIANT: Record<string, string> = {
  new: "secondary",
  contacted: "secondary",
  demo: "secondary",
  trial: "secondary",
  converted: "default",
  lost: "outline",
};

export default async function SuperAdminLeadsPage() {
  const session = await requireRole(["SUPER_ADMIN"]);
  void session;
  const leads = await listLeads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes commerciales</h1>
        <p className="text-muted-foreground">
          Contacts et demandes de démonstration reçus via les formulaires.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucune demande pour le moment.
            </div>
          ) : (
            <div className="divide-y">
              {leads.map((lead) => (
                <div key={lead.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{lead.name}</p>
                      {lead.school_name && (
                        <span className="text-sm text-muted-foreground">
                          — {lead.school_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[lead.email, lead.phone, lead.city].filter(Boolean).join(" · ") ||
                        "Sans coordonnées"}
                      {lead.est_students ? ` · ~${lead.est_students} élèves` : ""}
                    </p>
                    {lead.message && (
                      <p className="mt-1 text-sm text-muted-foreground">{lead.message}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source : {lead.source} —{" "}
                      {new Date(lead.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={STATUS_VARIANT[lead.status] as "default"}>
                      {lead.status}
                    </Badge>
                    <LeadStatusSelect leadId={lead.id} currentStatus={lead.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
