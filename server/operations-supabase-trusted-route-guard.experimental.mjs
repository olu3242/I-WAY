// B467: trusted route registry for tenant-scoped endpoints.
// Route ownership is configured server-side; no role or tenant is read from request data.
export function createTrustedRouteGuard({sessionGuard,routes}={}){
 if(typeof sessionGuard!=='function'||!Array.isArray(routes))throw Error('TRUSTED_ROUTES_REQUIRED');
 const registry=new Map();
 for(const route of routes){
  if(!route||typeof route.path!=='string'||!/^\/[a-z0-9/_-]+$/.test(route.path)||
   typeof route.method!=='string'||!['GET','POST','PUT','PATCH','DELETE'].includes(route.method)||
   typeof route.tenantId!=='string'||!route.tenantId||
   typeof route.role!=='string'||!route.role)throw Error('TRUSTED_ROUTE_INVALID');
  const key=route.method+' '+route.path;
  if(registry.has(key))throw Error('TRUSTED_ROUTE_DUPLICATE');
  registry.set(key,Object.freeze({tenantId:route.tenantId,role:route.role}));
 }
 return async function authorizeRequest({method,path,headers}={}){
  const route=registry.get(method+' '+path);
  if(!route)return {ok:false,status:404,error:'ROUTE_NOT_FOUND'};
  return sessionGuard({headers,tenantId:route.tenantId,role:route.role});
 };
}
