import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateResourceAuthorizer} from '../server/operations-auth-authorization.mjs';
const user='11111111-1111-4111-8111-111111111111',resource='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('resource permission and relationship checks do not equate role to authority',async()=>{
 for(const [role,permissions,kind,fleet,driver,expected] of [
 ['carrier',['load:view'],'load',null,null,true],['carrier',[],'load',null,null,false],
 ['fleet',['load:view'],'load','fleet-a',null,true],['fleet',['load:view'],'load','fleet-b',null,false],
 ['driver',['load:view'],'load',null,user,true],['driver',['load:view'],'load',null,'other',false],
 ['platform',['load:view'],'load',null,null,false],['platform',['platform:audit'],'tenant-audit',null,null,true],
 ['carrier',['platform:audit'],'tenant-audit',null,null,false]
 ]){
  let released=false;
  const client={query:async(sql,args)=>{if(sql.startsWith('SELECT set_config'))assert.equal(args[0],user);return {rows:sql.includes('FROM iway_private.auth_resources')?[{resource_id:resource,tenant_id:'tenant-a',kind,role,permissions,principal_id:user,fleet_id:fleet,member_fleet_id:'fleet-a',driver_id:driver}]:[]};},release:()=>{released=true;}};
  const authorize=createPrivateResourceAuthorizer({pool:{connect:async()=>client}});
  assert.equal(await authorize({userId:user,resourceId:resource}),expected);assert.equal(released,true);
 }
});
test('database outage denies without returning internal error',async()=>{
 const authorize=createPrivateResourceAuthorizer({pool:{connect:async()=>{throw Error('private');}}});
 assert.equal(await authorize({userId:user,resourceId:resource}),false);
});
