import {readFileSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';

// Public CA obtained from the download URL in Supabase's official dashboard source.
// Provenance and rotation procedure: docs/SUPABASE_SETUP.md.
export const supabaseRootFingerprint = '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';

export function postgresTlsOptions(hostname){
 const supabase = hostname === 'db.vnoxdinldneeczxibicp.supabase.co' || hostname === 'db.zolwjyhbfsxbdwyiwkbt.supabase.co' ||
  hostname.endsWith('.pooler.supabase.com');
 if(!supabase)return {rejectUnauthorized:true};
 let ca;
 try{
  ca=readFileSync(new URL('./certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8');
  const certificates=ca.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if(certificates?.length!==1||ca.trim()!==certificates[0])throw new Error();
  const certificate=new X509Certificate(ca);
  const now=Date.now();
  if(certificate.fingerprint256!==supabaseRootFingerprint || !certificate.ca ||
     !certificate.verify(certificate.publicKey) ||
     now<Date.parse(certificate.validFrom) || now>=Date.parse(certificate.validTo))throw new Error();
 }catch{
  throw new Error('SUPABASE_CA: INVALID_OR_UNAVAILABLE');
 }
 // This CA applies only to this PostgreSQL connection. Node's default hostname
 // validation remains active; no system trust store or TLS environment is changed.
 return {rejectUnauthorized:true,ca};
}
