// The expected transaction comes from the HttpOnly browser cookie, never from this URL.
export function parseSupabaseAuthCallback(input,{expectedOrigin,expectedState}={}){
 let url;
 try{url=new URL(input);}catch{throw Error('AUTH_CALLBACK_URL_INVALID');}
 if(typeof input!=='string'||input.length>4096||!expectedOrigin||url.origin!==expectedOrigin||
    url.username||url.password||url.pathname!=='/auth/callback'||
    !input.startsWith(expectedOrigin+'/auth/callback?'))
  throw Error('AUTH_CALLBACK_ORIGIN_INVALID');
 if(url.hash||[...url.searchParams.keys()].some(key=>!['code','state','error','error_code','error_description'].includes(key)))
  throw Error('AUTH_CALLBACK_TOKEN_IN_URL_FORBIDDEN');
 if(url.searchParams.has('error')||url.searchParams.has('error_code'))
  throw Error('AUTH_CALLBACK_PROVIDER_ERROR');
 const codes=url.searchParams.getAll('code');
 if(codes.length!==1||!codes[0]||codes[0].length>2048||/[\x00-\x20\x7f]/.test(codes[0]))
  throw Error('AUTH_CALLBACK_CODE_INVALID');
 const states=url.searchParams.getAll('state');
 // Supabase returns code; custom state is optional, but if present must match the independent cookie.
 if(typeof expectedState!=='string'||!expectedState||states.length>1||
    (states.length===1&&states[0]!==expectedState))throw Error('AUTH_CALLBACK_STATE_INVALID');
 return Object.freeze({code:codes[0]});
}
