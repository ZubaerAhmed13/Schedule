import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { runtimeConfiguration } from "../_shared/runtime-config.mjs";
import { accountServices } from "../_shared/account-services.ts";
import { createHandler } from "./core.mjs";
const url=Deno.env.get("SUPABASE_URL")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",publishable=Deno.env.get("SUPABASE_ANON_KEY")||"";
const ready=!!url&&!!secret&&!!publishable,origin=Deno.env.get("WEEKWISE_ALLOWED_ORIGIN")||"https://zubaerahmed13.github.io";
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=()=>createClient(url,secret,options);
const dependencies={enabled:ready,origin,...accountServices(url,secret,publishable)};
const handler=createHandler(dependencies),disabled=createHandler({...dependencies,enabled:false});
Deno.serve(async(request:Request)=>{
 if(!ready)return disabled(request);
 const from=request.headers.get('Origin');if(request.method==='OPTIONS'||(from&&from!==origin))return disabled(request);
 try{const config=await runtimeConfiguration(admin(),(name:string)=>Deno.env.get(name),['WEEKWISE_ACCOUNT_ERASURE_ENABLED']);return config.WEEKWISE_ACCOUNT_ERASURE_ENABLED==='true'?handler(request):disabled(request);}
 catch(_){return disabled(request);}
});
