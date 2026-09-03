/**
 * Communications externes (SMS / WhatsApp).
 * Abstraction : EduTrack -> Communication provider.
 * Sans provider configuré, on n'envoie AUCUN SMS/WhatsApp : on utilise
 * uniquement les notifications internes (§27). Ne pas coder d'API
 * WhatsApp maison.
 */

export type Channel = "sms" | "whatsapp";

export type CommunicationProvider = {
  readonly name: Channel | "none";
  readonly configured: boolean;
  send(to: string, message: string, channel: Channel): Promise<{ ok: boolean; error?: string }>;
};

/** Implémentation no-op (aucun provider configuré). */
class NoopProvider implements CommunicationProvider {
  readonly name = "none" as const;
  readonly configured = false;
  async send(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "Aucun fournisseur de communication configuré." };
  }
}

const noop = new NoopProvider();

/** Retourne le provider de communication courant (no-op par défaut). */
export function getCommunicationProvider(): CommunicationProvider {
  const name = (process.env.COMMUNICATION_PROVIDER ?? "").toLowerCase();
  if (name === "sms" || name === "whatsapp") {
    // Contrairement au billing, on garde volontairement un no-op tant qu'aucun
    // socle réel (API + clés) n'est fourni : §27. Ne pas connecter d'API maison.
    return noop;
  }
  return noop;
}

/** Vérifie si un channel externe est réellement actif. */
export function isExternalEnabled(channel: Channel): boolean {
  const p = getCommunicationProvider();
  return p.configured && p.name === channel;
}
