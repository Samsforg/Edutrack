import { getCommunicationProvider } from "@/lib/communications/provider";

/** Envoie un message WhatsApp via le provider configuré (no-op si non configuré). */
export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (!phone) return { ok: false, error: "Téléphone manquant." };
  try {
    const provider = getCommunicationProvider();
    if (!provider.configured) {
      return { ok: false, error: "WhatsApp non configuré (aucun provider)." };
    }
    return await provider.send(phone, message, "whatsapp");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
