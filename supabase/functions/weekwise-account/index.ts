import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createHandler } from "./core.mjs";

const url=Deno.env.get("SUPABASE_URL")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",publishable=Deno.env.get("SUPABASE_ANON_KEY")||"";
const enabled=Deno.env.get("WEEKWISE_ACCOUNT_ERASURE_ENABLED")==="true"&&!!url&&!!secret&&!!publishable;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=()=>createClient(url,secret,options);
const handler=createHandler({
 enabled,origin:Deno.env.get("WEEKWISE_ALLOWED_ORIGIN")||"https://zubaerahmed13.github.io",
 async getUser(jwt:string){const {data,error}=await admin().auth.getUser(jwt);if(error)return null;return data.user;},
 async reauthenticate(email:string,password:string){const client=createClient(url,publishable,options),{data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user||!data.session)return null;return {id:data.user.id,token:data.session.access_token};},
 async revokeSessions(jwt:string){const {error}=await admin().auth.admin.signOut(jwt,"global");if(error)throw error;},
 async deleteUser(id:string){const {error}=await admin().auth.admin.deleteUser(id);if(error)throw error;}
});
Deno.serve(handler);
