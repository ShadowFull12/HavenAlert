import { supabase } from './supabase';

/**
 * Logs an action to the audit_log table via the log_audit RPC function.
 */
export async function logAudit({
  venueId,
  actorId,
  actorRole,
  action,
  resourceType,
  resourceId,
  beforeState = null,
  afterState = null,
}) {
  try {
    const { error } = await supabase.rpc('log_audit', {
      p_venue_id: venueId,
      p_actor_id: actorId,
      p_actor_role: actorRole,
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_before: beforeState,
      p_after: afterState,
    });

    if (error) {
      console.error('Audit log error:', error);
    }
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
