// B451: parse and validate an authorization-code callback without persisting tokens.
// The exchange must occur on a trusted server using the expected PKCE verifier.
export function parseSupabaseAuthCallback(input,{expectedOrigin,expectedState}={}){
 let url;
 try{url=new URL(input);}catch{throw Error('AUTH_CALLBACK_URL_INVALID');}
 if(!expectedOrigin||url.origin!==expectedOrigin||url.pathname!=='/auth/callback')
  throw Error('AUTH_CALLBACK_ORIGIN_INVALID');
 if(url.hash||url.searchParams.has('access_token')||url.searchParams.has('refresh_token'))
  throw Error('AUTH_CALLBACK_TOKEN_IN_URL_FORBIDDEN');
 if(url.searchParams.has('error')||url.searchParams.has('error_code'))
  throw Error('AUTH_CALLBACK_PROVIDER_ERROR');
 const codes=url.searchParams.getAll('code');
 if(codes.length!==1||!codes[0]||codes[0].length>2048)throw Error('AUTH_CALLBACK_CODE_INVALID');
 const states=url.searchParams.getAll('state');
 if(typeof expectedState!=='string'||!expectedState||states.length!==1||states[0]!==expectedState)
  throw Error('AUTH_CALLBACK_STATE_INVALID');
 return Object.freeze({code:codes[0]});
}
