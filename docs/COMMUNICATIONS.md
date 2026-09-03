# Communications externes — SMS / WhatsApp

## Philosophie

- **No-op par défaut** : EduTrack n'envoie **aucun** SMS/WhatsApp sans provider configuré.
- **Abstraction** : `lib/communications/provider.ts` définit l'interface. Implémentations concrètes à brancher plus tard (Twilio, MessageBird, WhatsApp Business API, etc.).
- **Opt-in explicite** : chaque utilisateur gère ses préférences dans `/app/account` (email, push, SMS, WhatsApp).
- **Jamais de code maison** pour WhatsApp (pas de webhook scraping, pas d'API non officielle).

## Architecture

```
lib/communications/
├── provider.ts   # Interface CommunicationProvider + noop
├── sms.ts        # sendSMS(phone, message) → provider
├── whatsapp.ts   # sendWhatsApp(phone, message) → provider
```

```typescript
type Channel = "sms" | "whatsapp";

interface CommunicationProvider {
  readonly name: Channel | "none";
  readonly configured: boolean;
  send(to: string, message: string, channel: Channel): Promise<{ok, error?}>;
}
```

## Préférences utilisateur

Table `communication_preferences` (RLS : user sur lui-même) :
- `sms_enabled` (défaut false)
- `whatsapp_enabled` (défaut false)
- `email_enabled` (défaut true)
- `push_enabled` (défaut true)

Page `/app/account` : toggles par canal.

## Intégration future (quand provider réel)

1. Implémenter `CommunicationProvider` pour Twilio / MessageBird / WhatsApp Cloud API
2. Définir `COMMUNICATION_PROVIDER=sms|whatsapp` + `COMM_API_KEY` dans env
3. `getCommunicationProvider()` retournera l'implémentation réelle
4. `isExternalEnabled("sms")` / `"whatsapp"` pour gating UI

## Notifications intelligentes (Phase 8)

Nouvelles valeurs `notification_type` :
- `risk_detected`, `performance_drop`, `attendance_drop`
- `positive_progress`, `weekly_summary`, `insight`

Nouvelle colonne `priority` sur `notifications` : `critical | high | normal | low`.

Envoi via `notifyBillingUsers(userIds, {type, title, body, link, priority})` (service role, bypass RLS).

## Weekly Digest (push interne)

- Généré par job `generateWeeklyDigests` (file `ai_job_queue`)
- Envoie notification interne `weekly_summary` (pas SMS/WhatsApp par défaut)
- Contenu par rôle : parent (enfants), teacher (classes), admin (école)

## Sécurité

- Aucun numéro stocké hors `profiles`/`students` (RLS)
- Consentement requis avant tout envoi externe
- Pas de retry infini (max 3 attempts dans `ai_job_queue`)
- Logs d'audit dans `ai_audit_logs` (action: `communication.send`)

## Tests

MockProvider utilisé pour tests unitaires — pas d'envoi réel.