// FCC-03 B15. Caller supplies trusted current session from the authenticated server.
// No browser storage value can establish identity or authorize replay.
export function createSessionBoundOfflineQueue({storage,identity,readSession} = {}) {
  if (!storage || typeof readSession !== 'function' ||
      !identity?.actorId || !identity?.tenantId || !identity?.sessionId) {
    throw new Error('OFFLINE_SESSION_REQUIRED');
  }
  let locked = false;
  async function authorize() {
    if (locked) throw new Error('OFFLINE_SESSION_LOCKED');
    let current;
    try { current = await readSession(); }
    catch { locked = true; throw new Error('OFFLINE_SESSION_UNVERIFIED'); }
    if (!current || current.active !== true ||
        current.actorId !== identity.actorId ||
        current.tenantId !== identity.tenantId ||
        current.sessionId !== identity.sessionId) {
      locked = true;
      throw new Error('OFFLINE_SESSION_MISMATCH');
    }
  }
  return Object.freeze({
    async list() { await authorize(); return storage.list(); },
    async enqueue(command) { await authorize(); return storage.enqueue(command); },
    async acknowledge(key) { await authorize(); return storage.acknowledge(key); },
    async replay(send) {
      if (typeof send !== 'function') throw new Error('OFFLINE_SEND_REQUIRED');
      await authorize();
      const entries = await storage.list();
      const confirmed = [];
      for (const entry of entries) {
        await authorize();
        let receipt;
        try { receipt = await send(entry); }
        catch { return {status:'needs_attention',confirmed,remaining:entries.slice(confirmed.length)}; }
        if (receipt?.confirmed !== true || receipt.idempotencyKey !== entry.idempotencyKey)
          return {status:'needs_attention',confirmed,remaining:entries.slice(confirmed.length)};
        await authorize();
        await storage.acknowledge(entry.idempotencyKey);
        confirmed.push({idempotencyKey:entry.idempotencyKey,status:'confirmed_by_server'});
      }
      return {status:'confirmed_by_server',confirmed,remaining:[]};
    },
    async invalidate() { locked = true; await storage.close(); }
  });
}
