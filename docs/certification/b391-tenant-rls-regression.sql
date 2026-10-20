-- B391 disposable-fixture tenant isolation regression.
-- Run after b391-postgres-onboarding-fixture.sql; never against hosted data.
BEGIN;
CREATE ROLE iway_fixture_writer NOLOGIN;
GRANT USAGE ON SCHEMA operations_onboarding TO iway_fixture_writer;
GRANT SELECT, INSERT, UPDATE ON operations_onboarding.invitations TO iway_fixture_writer;
CREATE POLICY fixture_tenant_select ON operations_onboarding.invitations
 FOR SELECT TO iway_fixture_writer
 USING (tenant_id = nullif(current_setting('iway.fixture_tenant', true),'')::uuid);
CREATE POLICY fixture_tenant_insert ON operations_onboarding.invitations
 FOR INSERT TO iway_fixture_writer
 WITH CHECK (tenant_id = nullif(current_setting('iway.fixture_tenant', true),'')::uuid);
CREATE POLICY fixture_tenant_update ON operations_onboarding.invitations
 FOR UPDATE TO iway_fixture_writer
 USING (tenant_id = nullif(current_setting('iway.fixture_tenant', true),'')::uuid)
 WITH CHECK (tenant_id = nullif(current_setting('iway.fixture_tenant', true),'')::uuid);
CREATE ROLE iway_fixture_actor LOGIN PASSWORD 'actor_fixture_only';
GRANT iway_fixture_writer TO iway_fixture_actor;
SET ROLE iway_fixture_actor;
SET LOCAL iway.fixture_tenant = '11111111-1111-4111-8111-111111111111';
INSERT INTO operations_onboarding.invitations(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,token_hash,state,expires_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','fixture@example.invalid','{"role":"driver"}','fixture','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','CREATED',now()+interval '1 hour');
DO $$ BEGIN
 IF (SELECT count(*) FROM operations_onboarding.invitations) <> 1 THEN RAISE EXCEPTION 'own tenant read failed'; END IF;
END $$;
SET LOCAL iway.fixture_tenant = '33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
 IF (SELECT count(*) FROM operations_onboarding.invitations) <> 0 THEN RAISE EXCEPTION 'cross tenant read exposed'; END IF;
 IF EXISTS (SELECT 1 FROM operations_onboarding.invitations WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'cross tenant id exposed'; END IF;
END $$;
DO $$ BEGIN
 IF (SELECT count(*) FROM (
   UPDATE operations_onboarding.invitations SET state='OPENED'
   WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' RETURNING id
 ) AS attempted) <> 0 THEN RAISE EXCEPTION 'cross tenant update succeeded'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
