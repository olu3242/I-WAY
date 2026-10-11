/** Pure policy helper; callers must fetch authoritative relationships server-side. */
export function authorize({actor, action, resource}) {
  if (!actor?.id || !resource?.tenantId || !actor?.tenantId) return false;
  if (!actor.permissions?.includes(action)) return false;
  if (actor.tenantId !== resource.tenantId) return false;
  if (action === 'load:dispatch' && actor.role !== 'carrier') return false;
  if (action === 'driver:approve' && actor.role !== 'carrier') return false;
  if (action === 'load:execute' && (actor.role !== 'driver' || resource.driverId !== actor.id)) return false;
  if (actor.role === 'fleet' && resource.fleetId !== actor.fleetId) return false;
  return true;
}
