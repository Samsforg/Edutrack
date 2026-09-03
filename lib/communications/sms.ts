import { getCommunicationProvider } from "@/lib/communications/provider";

/** Envoie un SMS via le provider configuré (no-op si non configuré). */
export async function sendSMS(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (!phone) return { ok: false, error: "Téléphone manquant." };
  try {
    const provider = getCommunicationProvider();
    if (!provider.configured) {
      return { ok: false, error: "SMS non configuré (aucun provider)." };
    }
    return await provider.send(phone, message, "sms");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
