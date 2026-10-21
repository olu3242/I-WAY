// B450: fail-closed staging configuration. This module does not send invites.
export function resolveSupabaseStagingConfig(env=process.env){
 const projectRef='vnoxdinldneeczxibicp';
 const url=`https://${projectRef}.supabase.co`;
 if(env.IWAY_SUPABASE_STAGE_ENABLED!=='true')throw Error('IWAY_SUPABASE_STAGING_DISABLED');
 if(env.IWAY_SUPABASE_PROJECT_REF!==projectRef)throw Error('IWAY_SUPABASE_PROJECT_MISMATCH');
 if(env.IWAY_SUPABASE_URL!==url)throw Error('IWAY_SUPABASE_URL_MISMATCH');
 const redirectTo=env.IWAY_SUPABASE_AUTH_REDIRECT;
 if(typeof redirectTo!=='string')throw Error('IWAY_SUPABASE_REDIRECT_REQUIRED');
 let parsed;
 try{parsed=new URL(redirectTo);}catch{throw Error('IWAY_SUPABASE_REDIRECT_INVALID');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash||parsed.search||!parsed.hostname||parsed.hostname==='localhost')
  throw Error('IWAY_SUPABASE_REDIRECT_INVALID');
 if(env.IWAY_SUPABASE_APPROVED_REDIRECT!==redirectTo)
  throw Error('IWAY_SUPABASE_REDIRECT_NOT_APPROVED');
 return Object.freeze({projectRef,url,redirectTo,allowedRedirects:Object.freeze([redirectTo])});
}
