import {uatApplicationFixture} from './uat-application-fixture.mjs';
import {addUser} from '../../server/operations-auth.mjs';
import {createUatWorkflow} from '../../server/operations-uat-workflow.mjs';
import {createDurableUatApplication} from '../../server/operations-durable-uat.mjs';
import {validateOwnerProfiles} from '../../server/operations-owner-profiles.mjs';
export async function ownerProfilesFixture(t){
 const f=await uatApplicationFixture(t,{fullPermissions:true,googleAssurance:'aal2'}),profiles=[];
 for(const owner of f.roster.filter(e=>['platform','driver'].includes(e.role))){
  for(const model of f.roster){
   const tenantId=model.role==='platform'?f.governance:model.tenantId;
   const actor=model.role===owner.role?f.store.principal(owner.principalId):addUser(f.store,{tenantId,username:owner.role+'-'+model.role+'@illustrative.invalid',name:'Illustrative owner '+owner.role+' '+model.role,role:model.role,fleetId:model.fleetId,permissions:model.permissions,identityOnly:true});
   const next={...actor,ownerUserId:owner.userId};f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(next),actor.id);
   profiles.push({ownerUserId:owner.userId,principalId:actor.id,role:model.role,tenantId,fleetId:model.fleetId,permissions:model.permissions});
  }
 }
 f.dependencies.workflow=createUatWorkflow({...f.uat.dependencies,ownerUserIds:[f.roster[0].userId,f.roster[3].userId]});
 f.dependencies.ownerProfiles=validateOwnerProfiles(profiles,f.roster,f.governance);
 const engine={validatePlatformNamespace:async id=>id===f.governance,verifyUatEntry:async p=>{const a=f.store.principal(p.principalId);return !!a?.active&&a.role===p.role;},transaction:async(scope,fn)=>{if(f.store.principal(scope.actorId)?.tenantId!==scope.tenantId)throw Error('DENIED');return fn({store:f.store,operations:f.ops});}};
 return {...f,profiles,engine,app:await createDurableUatApplication({...f.dependencies,engine})};
}
