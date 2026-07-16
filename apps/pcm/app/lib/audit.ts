import 'server-only';
import { createAdminClient } from '@jlycc/supabase/admin';

export type AuditEvent = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
};

export async function logAudit(event: AuditEvent) {
  if (!event.actorId || !event.action || !event.entityType || !event.entityId) {
    throw new Error("Missing required audit fields");
  }

  const admin = createAdminClient();
  const { error } = await admin.from('admin_audit_logs').insert({
    actor_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId,
    before: event.before || null,
    after: event.after || null,
  });

  if (error) {
    console.error("Failed to insert audit log", error);
    throw new Error("Audit log insertion failed");
  }
}
