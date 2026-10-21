export const authColumns={
  "auth_pkce_transactions": {
    "state_hash": "text",
    "verifier": "text",
    "expires_at": "timestamp with time zone",
    "consumed_at": "timestamp with time zone",
    "created_at": "timestamp with time zone"
  },
  "auth_server_sessions": {
    "session_hash": "text",
    "user_id": "uuid",
    "access_token": "text",
    "refresh_token": "text",
    "expires_at": "timestamp with time zone",
    "access_expires_at": "timestamp with time zone",
    "revoked_at": "timestamp with time zone",
    "refresh_claim": "uuid",
    "refresh_started_at": "timestamp with time zone",
    "token_version": "bigint",
    "created_at": "timestamp with time zone"
  },
  "auth_tenant_roles": {
    "user_id": "uuid",
    "tenant_id": "uuid",
    "role": "text",
    "granted_at": "timestamp with time zone",
    "revoked_at": "timestamp with time zone",
    "active": "boolean",
    "permissions": "text[]",
    "principal_id": "uuid",
    "fleet_id": "uuid"
  },
  "auth_tenants": {
    "tenant_id": "uuid",
    "active": "boolean"
  },
  "auth_resources": {
    "resource_id": "uuid",
    "tenant_id": "uuid",
    "kind": "text",
    "fleet_id": "uuid",
    "driver_id": "uuid",
    "active": "boolean"
  }
};
