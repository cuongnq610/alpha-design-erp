import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const json=(status:number,body:unknown,origin:string)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':origin,
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type, x-request-id',
    'access-control-allow-methods':'POST, OPTIONS',
    'vary':'Origin',
    'x-content-type-options':'nosniff'
  }
});


function keyFromJsonEnv(name:string){
  try{
    const raw=Deno.env.get(name)||'';
    const parsed=raw?JSON.parse(raw):{};
    return String(parsed?.default||Object.values(parsed||{})[0]||'');
  }catch{return '';}
}

function allowedOrigin(req:Request){
  const origin=req.headers.get('origin')||'';
  if(!origin)return '';
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.includes(origin))throw Object.assign(new Error('Origin không được phép.'),{status:403});
  return origin;
}

Deno.serve(async req=>{
  let origin='';
  try{
    origin=allowedOrigin(req);
    if(req.method==='OPTIONS')return json(204,{},origin);
    if(req.method!=='POST')return json(405,{ok:false,error:'Phương thức không được hỗ trợ.'},origin);

    const url=Deno.env.get('SUPABASE_URL')||'';
    const publishable=Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||keyFromJsonEnv('SUPABASE_PUBLISHABLE_KEYS')||Deno.env.get('SUPABASE_ANON_KEY')||'';
    const adminKey=Deno.env.get('SUPABASE_SECRET_KEY')||keyFromJsonEnv('SUPABASE_SECRET_KEYS')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    if(!url||!publishable||!adminKey)throw Object.assign(new Error('Edge Function chưa được cấu hình Publishable/Anon key và Secret/Service Role key.'),{status:503});

    const authorization=req.headers.get('authorization')||'';
    if(!/^Bearer\s+\S+/i.test(authorization))throw Object.assign(new Error('Thiếu access token.'),{status:401});

    const userClient=createClient(url,publishable,{
      global:{headers:{Authorization:authorization}},
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const {data:context,error:contextError}=await userClient.rpc('get_my_context');
    if(contextError||!context?.company_id)throw Object.assign(new Error('Phiên hoặc membership không hợp lệ.'),{status:403});
    const permissions=Array.isArray(context.permissions)?context.permissions:[];
    if(!permissions.includes('admin')&&!permissions.includes('users.manage'))throw Object.assign(new Error('Không đủ quyền mời người dùng.'),{status:403});
    if(context.mfa_required&&context.aal!=='aal2')throw Object.assign(new Error('Cần xác thực MFA cấp AAL2.'),{status:403});

    const body=await req.json().catch(()=>({}));
    const email=String(body.email||'').trim().toLowerCase();
    const fullName=String(body.fullName||'').trim();
    const roleCode=String(body.roleCode||'').trim().toUpperCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Object.assign(new Error('Email không hợp lệ.'),{status:422});
    if(fullName.length<2||fullName.length>160)throw Object.assign(new Error('Họ tên không hợp lệ.'),{status:422});
    if(!/^[A-Z0-9_-]{2,60}$/.test(roleCode))throw Object.assign(new Error('Mã vai trò không hợp lệ.'),{status:422});

    const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data:role,error:roleError}=await admin.from('roles').select('id,code,name').eq('company_id',context.company_id).eq('code',roleCode).single();
    if(roleError||!role)throw Object.assign(new Error('Vai trò không tồn tại trong công ty.'),{status:422});

    const redirectTo=Deno.env.get('SITE_URL')||undefined;
    const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName},redirectTo});
    if(inviteError||!invited.user)throw Object.assign(new Error(inviteError?.message||'Không thể gửi thư mời.'),{status:422});
    const invitedId=invited.user.id;

    try{
      const {error:profileError}=await admin.from('profiles').upsert({user_id:invitedId,full_name:fullName,email,status:'active'},{onConflict:'user_id'});
      if(profileError)throw profileError;
      const {error:memberError}=await admin.from('memberships').upsert({company_id:context.company_id,user_id:invitedId,role_id:role.id,status:'active'},{onConflict:'company_id,user_id'});
      if(memberError)throw memberError;
      await admin.from('security_events').insert({
        company_id:context.company_id,user_id:context.user_id,event_type:'user.invite',severity:'info',success:true,
        user_agent:req.headers.get('user-agent'),details:{invited_user_id:invitedId,email,role_code:roleCode}
      });
    }catch(error){
      await admin.auth.admin.deleteUser(invitedId).catch(()=>{});
      throw error;
    }

    return json(200,{ok:true,userId:invitedId,email,role:{code:role.code,name:role.name}},origin);
  }catch(error){
    const status=Number((error as {status?:number})?.status)||400;
    return json(status,{ok:false,error:String((error as Error)?.message||error)},origin);
  }
});
