import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresOpaqueSessionStore} from '../server/operations-supabase-opaque-session-store.experimental.mjs';
test('B456 stores only hashed session id and revokes sessions',async()=>{
 const rows=new Map();let savedHash;
 const query=async(sql,args)=>{
 if(sql.includes('INSERT')){savedHash=args[0];rows.set(args[0],{user_id:args[1],access_token:args[2],refresh_token:args[3],expires_at:args[4],revoked_at:null});return {rowCount:1};}
 const row=rows.get(args[0]);if(sql.includes('SELECT'))return row&&!row.revoked_at&&row.expires_at>args[1]?{rowCount:1,rows:[row]}:{rowCount:0,rows:[]};
 if(row&&!row.revoked_at){row.revoked_at=args[1];return {rowCount:1};}return {rowCount:0};
 };
 const store=createPostgresOpaqueSessionStore({query});
 const {id}=await store.create({userId:'11111111-2222-3333-4444-555555555555',accessToken:'private-access',refreshToken:'private-refresh'});
 assert.notEqual(savedHash,id);assert.equal(savedHash.length,64);
 assert.equal((await store.get(id)).access_token,'private-access');
 assert.equal(await store.revoke(id),true);assert.equal(await store.get(id),null);
 assert.equal(await store.revoke(id),false);
});
test('B456 rejects malformed and missing session credentials',async()=>{
 const store=createPostgresOpaqueSessionStore({query:async()=>({rowCount:0})});
 assert.equal(await store.get('invalid'),null);
 await assert.rejects(store.create({userId:'bad',accessToken:'token',refreshToken:'refresh'}),/SESSION_INVALID/);
});
