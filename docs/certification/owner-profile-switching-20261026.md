# Staging owner profile switching

Two explicitly approved staging owner identities can select Platform Admin, Carrier Admin, Fleet Company, and Driver. Grants live in the approved private deployment configuration. Public deployment and ordinary tester access are unchanged.

Each owner uses their own separate principals. The original login and native session remain required on every request. A selected profile is bound to that parent session with an opaque HttpOnly cookie and a persisted, rotating CSRF value. Owner access requires a verified AAL2 provider proof, current native membership, exact granted permissions, and active tenant/fleet/driver relationships. A profile switch does not change another tester's account or identity binding.

Profile grants and switches are audited. Actions performed through an owned principal retain the authenticated owner's identity in audit details. Sessions cannot silently fall back to a different profile after an invalid selection cookie. Signing out revokes the original session and clears the profile cookie. A changed deployment manifest fences existing hosted runtimes.

Owners signing in with a password can enroll their first TOTP authenticator if no verified factor exists. The setup key is returned only after verified password authentication, remains in the no-store same-origin response and encrypted pending-MFA record, and is removed from the UI after verification. No application session is issued until the provider verifies AAL2. Existing factors are reused; no factor is removed or replaced. Completing enrollment requires the account holder's authenticator. Live account passwords and authenticator codes are never collected by this implementation workflow.

Validation covers both owners, all four profiles, non-owner denial, cross-owner selection denial, CSRF rotation, forged cookies, revocation, MFA, and account attribution. Browser scenarios exercise the picker on mobile and desktop, first-time authenticator setup with synthetic credentials, logout, and durable PostgreSQL reconstruction. Hosted account-holder sign-in remains a separate user verification step.
