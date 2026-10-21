// B469: compose trusted route ownership, cookie session authorization and safe HTTP responses.
// Dependency injection keeps the boundary testable before approved hosted deployment.
import {createSessionHttpGuard} from './operations-supabase-session-http-guard.experimental.mjs';
import {createTrustedRouteGuard} from './operations-supabase-trusted-route-guard.experimental.mjs';
import {createProtectedHttpHandler} from './operations-supabase-protected-http-response.experimental.mjs';
export function createProtectedRoutePipeline({authorizeSession,routes,handleAuthorized}={}){
 const sessionGuard=createSessionHttpGuard({authorize:authorizeSession});
 const authorizeRequest=createTrustedRouteGuard({sessionGuard,routes});
 return createProtectedHttpHandler({authorizeRequest,handleAuthorized});
}
