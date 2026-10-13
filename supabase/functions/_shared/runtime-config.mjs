// Server-only configuration. Never import this module into the Pages client.
export const RUNTIME_KEYS=Object.freeze(['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','WEEKWISE_PUSH_CRON_SECRET','WEEKWISE_CALENDAR_ENCRYPTION_KEY','GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_CALENDAR_CLIENT_SECRET','MICROSOFT_CALENDAR_CLIENT_ID','MICROSOFT_CALENDAR_CLIENT_SECRET','MICROSOFT_CALENDAR_TENANT','WEEKWISE_ACCOUNT_ERASURE_ENABLED','WEEKWISE_ACTIVATION_CHECK_SECRET']);
export async function runtimeConfiguration(admin,env,names){
 if(!Array.isArray(names)||names.some(name=>!RUNTIME_KEYS.includes(name)))throw new Error('Unknown server configuration key.');
 /** @type {Record<string,string>} */
 const values={};const missing=[];
 for(const name of names){const value=env(name);if(typeof value==='string'&&value.trim())values[name]=value.trim();else missing.push(name);}
 if(missing.length){
  const {data,error}=await admin.rpc('weekwise_runtime_configuration',{p_names:missing});
  if(error||!data||typeof data!=='object'||Array.isArray(data))throw new Error('Secure Weekwise configuration is unavailable.');
  for(const name of missing)if(typeof data[name]==='string'&&data[name].length<=8192)values[name]=data[name];
 }
 return values;
}
export async function pushConfiguration(admin,env,generate){
 let values=await runtimeConfiguration(admin,env,['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','WEEKWISE_PUSH_CRON_SECRET']);
 if(!values.VAPID_PUBLIC_KEY&&!values.VAPID_PRIVATE_KEY){
  const pair=generate(),{error}=await admin.rpc('weekwise_install_vapid_keys',{p_public:pair.publicKey,p_private:pair.privateKey,p_project_url:env("SUPABASE_URL")?.replace(/\/+$/,"")||null});
  if(error)throw new Error('Could not provision secure Weekwise push keys.');
  values=await runtimeConfiguration(admin,env,['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','WEEKWISE_PUSH_CRON_SECRET']);
 }
 if(!values.VAPID_PUBLIC_KEY||!values.VAPID_PRIVATE_KEY||!values.VAPID_SUBJECT||!values.WEEKWISE_PUSH_CRON_SECRET)throw new Error('Background push configuration is incomplete. Existing keys were not replaced.');
 return values;
}

export function activationSecretMatches(actual,expected){
 if(typeof actual!=="string"||typeof expected!=="string"||expected.length!==64||actual.length!==64)return false;
 let difference=0;for(let index=0;index<64;index++)difference|=actual.charCodeAt(index)^expected.charCodeAt(index);
 return difference===0;
}
