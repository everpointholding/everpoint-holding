import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';

const DOCS = [
  {id:'profile',title:'Company Profile',desc:'EverPoint Holding company profile.',url:'documents/Company Profile.pdf'},
  {id:'offer',title:'EverPointHolding-Offer-Letter',desc:'Employment offer letter.',url:'documents/EverPointHolding-Offer-Letter.pdf'},
  {id:'background',title:'Candidate Background Check Consent Form',desc:'Candidate background screening consent form.',url:'documents/Candidate Background Check Consent Form.pdf'},
  {id:'clock',title:'Daily Clock-In _ Clock-Out Sheet',desc:'Daily attendance record.',url:'documents/Daily Clock-In _ Clock-Out Sheet.pdf'},
  {id:'deposit',title:'Employee Direct Deposit Enrollment Form',desc:'Payroll direct deposit enrollment form.',url:'documents/Employee Direct Deposit Enrollment Form.pdf'},
  {id:'tools',title:'Tools & Technology',desc:'Work equipment and technology information.',url:'documents/Tools & Technology.pdf'},
  {id:'expenses',title:'Employee Expense Reimbursement Request',desc:'Employee expense reimbursement form.',url:'documents/Employee Expense Reimbursement Request.pdf'}
];
const DEFAULT_DOCS = {profile:'available',offer:'pending',background:'locked',clock:'available',deposit:'locked',tools:'available',expenses:'locked'};
const STEPS = ['Application reviewed','Shortlisted','Interview','Onboarding','Device activation','Work starts!'];
const SESSION_COOKIE = 'ep_session';
const encoder = new TextEncoder();

function json(data, status=200, headers={}) {
  if(typeof status==='object'){ headers=status.headers||{}; status=status.status||200; }
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8', ...headers}});
}
function ok(data){ return json(data); }
function fail(message,status=400){ return json({error:message},status); }
function now(){ return new Date().toISOString(); }
function id(prefix='id'){ return `${prefix}_${crypto.randomUUID()}`; }
function b64(bytes){ let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function unb64(s){ const x=s.replaceAll('-','+').replaceAll('_','/'); const p=x+'='.repeat((4-x.length%4)%4); const raw=atob(p); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
async function sha256(value){ const h=await crypto.subtle.digest('SHA-256',encoder.encode(value)); return b64(new Uint8Array(h)); }
async function randomToken(){ const bytes=new Uint8Array(32); crypto.getRandomValues(bytes); return b64(bytes); }
async function passwordHash(password,saltB64){
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256);
  return {salt:b64(salt),hash:b64(new Uint8Array(bits))};
}
async function verifyPassword(password,salt,expected){ const x=await passwordHash(password,salt); return x.hash===expected; }
function cookie(token,maxAge){ return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`; }
function clearCookie(){ return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`; }
function getCookie(request,name){ const v=request.headers.get('Cookie')||''; const part=v.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'=')); return part?.slice(name.length+1)||null; }
async function createSession(env,kind,subjectId){
  const token=await randomToken(); const tokenHash=await sha256(token); const days=Math.max(1,Number(env.SESSION_DAYS||7)); const expires=new Date(Date.now()+days*86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id,token_hash,kind,subject_id,expires_at,created_at) VALUES (?,?,?,?,?,?)').bind(id('ses'),tokenHash,kind,subjectId,expires,now()).run();
  return {token,maxAge:days*86400};
}
async function session(env,request,kind){
  const token=getCookie(request,SESSION_COOKIE); if(!token)return null;
  const tokenHash=await sha256(token);
  const row=await env.DB.prepare('SELECT * FROM sessions WHERE token_hash=? AND kind=? AND expires_at>?').bind(tokenHash,kind,now()).first();
  return row||null;
}
async function destroySession(env,request){ const token=getCookie(request,SESSION_COOKIE); if(token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run(); }
function corsHeaders(request){ return {'cache-control':'no-store'}; }
async function requireAdmin(env,request){ const s=await session(env,request,'admin'); return s; }
async function requireEmployee(env,request){ const s=await session(env,request,'employee'); return s; }
function parseEmployee(row){ return {...row,active:!!row.active,chatEnabled:!!row.chat_enabled,steps:JSON.parse(row.steps_json||'[]'),docs:JSON.parse(row.docs_json||'{}')}; }
function publicEmployee(row){ const e=parseEmployee(row); delete e.access_salt; delete e.access_hash; delete e.steps_json; delete e.docs_json; delete e.chat_enabled; return e; }
function validateTeams(v){ return /^(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@[A-Za-z0-9._-]{3,}|[A-Za-z0-9._-]{3,})$/.test(String(v||'').trim()); }
function applicationPayload(body){
  const required=['firstName','lastName','email','phone','dob','address','role','employmentType','workArrangement','employmentStatus','experience','education','skills','history','motivation','availability','teams'];
  for(const k of required) if(!String(body?.[k]??'').trim()) throw new Error(`Missing required field: ${k}`);
  const roles=['Data Entry','Records Entry Clerk','Executive Assistance','Data Entry Clerk'];
  const types=['Full-Time','Part-Time','Contract']; const arrangements=['Remote','Hybrid','On-site'];
  if(!roles.includes(body.role)||!types.includes(body.employmentType)||!arrangements.includes(body.workArrangement)) throw new Error('Invalid job selection.');
  if(!validateTeams(body.teams)) throw new Error('Please provide a valid Microsoft Teams email or username.');
  return body;
}
async function notifyAdmin(env,title,body){ await env.DB.prepare('INSERT INTO notifications (id,audience,title,body,is_read,created_at) VALUES (?,?,?,?,0,?)').bind(id('ntf'),'admin',title,body,now()).run(); }
async function notifyEmployee(env,employeeId,title,body){ await env.DB.prepare('INSERT INTO notifications (id,audience,employee_id,title,body,is_read,created_at) VALUES (?,?,?,?,?,0,?)').bind(id('ntf'),'employee',employeeId,title,body,now()).run(); }
async function listAdminData(env){
  const [emps,apps,notifs]=await Promise.all([
    env.DB.prepare('SELECT * FROM employees ORDER BY name').all(),
    env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all(),
    env.DB.prepare("SELECT * FROM notifications WHERE audience='admin' ORDER BY created_at DESC LIMIT 100").all()
  ]);
  return {employees:emps.results.map(publicEmployee),applications:apps.results,notifications:notifs.results,docs:DOCS,steps:STEPS};
}

// Private employee PDF uploads are stored in Netlify Blobs; upload metadata lives in the database.
function uploadStore(){ return getStore('employee-documents'); }
async function storeUpload(keyPath,file){
  await uploadStore().set(keyPath,await file.arrayBuffer(),{metadata:{contentType:'application/pdf',fileName:file.name}});
}
async function fetchUpload(keyPath){
  const data=await uploadStore().get(keyPath,{type:'arrayBuffer'});
  return data?{body:data}:null;
}

async function api(request,env,url){
  const path=url.pathname, method=request.method;
  if(path==='/api/health') return ok({ok:true,time:now()});

  if(path==='/api/setup' && method==='POST'){
    const body=await request.json().catch(()=>({}));
    const token=request.headers.get('X-Setup-Token')||body.setupToken||'';
    if(!env.SETUP_TOKEN || token!==env.SETUP_TOKEN) return fail('Invalid setup token.',403);
    const email=String(body.email||'').trim().toLowerCase(), password=String(body.password||'');
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<12) return fail('Use a valid email and a password of at least 12 characters.');
    const existing=await env.DB.prepare('SELECT id FROM admins ORDER BY created_at LIMIT 1').first();
    const ph=await passwordHash(password); const t=now();
    if(existing){
      await env.DB.prepare('UPDATE admins SET email=?,password_salt=?,password_hash=?,updated_at=? WHERE id=?').bind(email,ph.salt,ph.hash,t,existing.id).run();
      await env.DB.prepare("DELETE FROM sessions WHERE kind='admin'").run();
      return ok({ok:true,message:'Admin credentials updated successfully. Existing admin sessions were signed out. You can now sign in with the new credentials.'});
    }
    await env.DB.prepare('INSERT INTO admins (id,email,password_salt,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id('adm'),email,ph.salt,ph.hash,t,t).run();
    return ok({ok:true,message:'Admin account created successfully. You can now sign in.'});
  }

  if(path==='/api/careers/apply' && method==='POST'){
    const body=await request.json().catch(()=>null); if(!body)return fail('Invalid application data.');
    try{ applicationPayload(body); }catch(e){ return fail(e.message); }
    const a={id:id('app'),firstName:String(body.firstName).trim(),lastName:String(body.lastName).trim(),name:`${String(body.firstName).trim()} ${String(body.lastName).trim()}`,email:String(body.email).trim().toLowerCase(),phone:String(body.phone).trim(),dob:String(body.dob),address:String(body.address).trim(),role:String(body.role),employmentType:String(body.employmentType),workArrangement:String(body.workArrangement),employmentStatus:String(body.employmentStatus),experience:String(body.experience),education:String(body.education).trim(),skills:String(body.skills).trim(),history:String(body.history).trim(),motivation:String(body.motivation).trim(),availability:String(body.availability),teams:String(body.teams).trim(),status:'New',createdAt:now()};
    await env.DB.prepare(`INSERT INTO applications (id,first_name,last_name,name,email,phone,dob,address,role,employment_type,work_arrangement,employment_status,experience,education,skills,history,motivation,availability,teams,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(a.id,a.firstName,a.lastName,a.name,a.email,a.phone,a.dob,a.address,a.role,a.employmentType,a.workArrangement,a.employmentStatus,a.experience,a.education,a.skills,a.history,a.motivation,a.availability,a.teams,a.status,a.createdAt).run();
    await notifyAdmin(env,'New job application',`${a.name} applied for ${a.role}. Microsoft Teams contact: ${a.teams}.`);
    return ok({ok:true,message:'Application submitted successfully.'});
  }

  if(path==='/api/employee/login' && method==='POST'){
    const body=await request.json().catch(()=>({})); const name=String(body.name||'').trim().toLowerCase(), email=String(body.email||'').trim().toLowerCase(), code=String(body.code||'');
    const row=await env.DB.prepare('SELECT * FROM employees WHERE lower(name)=? AND lower(email)=?').bind(name,email).first();
    if(!row)return fail('Sign-in unsuccessful. Please check your details.',401);
    if(!row.active)return fail('This employee account is currently inactive.',403);
    if(!(await verifyPassword(code,row.access_salt,row.access_hash)))return fail('Sign-in unsuccessful. Please check your details.',401);
    const s=await createSession(env,'employee',row.id); return json({employee:publicEmployee(row)},{status:200,headers:{...corsHeaders(request),'set-cookie':cookie(s.token,s.maxAge)}});
  }
  if(path==='/api/employee/logout' && method==='POST'){await destroySession(env,request);return json({ok:true},{headers:{'set-cookie':clearCookie()}});}
  if(path==='/api/employee/me' && method==='GET'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const row=await env.DB.prepare('SELECT * FROM employees WHERE id=?').bind(s.subject_id).first(); if(!row)return fail('Employee not found.',404);
    return ok({employee:publicEmployee(row),docs:DOCS,steps:STEPS});
  }
  if(path==='/api/employee/notifications' && method==='GET'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const rows=await env.DB.prepare("SELECT * FROM notifications WHERE audience='employee' AND employee_id=? ORDER BY created_at DESC LIMIT 50").bind(s.subject_id).all(); return ok({notifications:rows.results});
  }
  if(path==='/api/employee/notifications/read' && method==='POST'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); await env.DB.prepare("UPDATE notifications SET is_read=1 WHERE audience='employee' AND employee_id=?").bind(s.subject_id).run(); return ok({ok:true});
  }
  if(path==='/api/employee/chat' && method==='GET'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const emp=await env.DB.prepare('SELECT chat_enabled FROM employees WHERE id=?').bind(s.subject_id).first(); const rows=await env.DB.prepare('SELECT id,sender,text,created_at FROM messages WHERE employee_id=? ORDER BY created_at ASC').bind(s.subject_id).all(); return ok({enabled:!!emp?.chat_enabled,messages:rows.results});
  }
  if(path==='/api/employee/chat' && method==='POST'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const emp=await env.DB.prepare('SELECT name,chat_enabled FROM employees WHERE id=?').bind(s.subject_id).first(); if(!emp?.chat_enabled)return fail('Chat is currently locked.',403); const body=await request.json().catch(()=>({})); const text=String(body.text||'').trim(); if(!text||text.length>1000)return fail('Message must be 1–1000 characters.'); await env.DB.prepare('INSERT INTO messages (id,employee_id,sender,text,created_at) VALUES (?,?,?,?,?)').bind(id('msg'),s.subject_id,'employee',text,now()).run(); await notifyAdmin(env,'New employee message',`${emp.name} sent a new support message.`); return ok({ok:true});
  }
  if(path==='/api/employee/uploads' && method==='GET'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const rows=await env.DB.prepare('SELECT id,title,related,file_name,size,status,created_at FROM uploads WHERE employee_id=? ORDER BY created_at DESC').bind(s.subject_id).all(); return ok({uploads:rows.results});
  }
  if(path==='/api/employee/uploads' && method==='POST'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const form=await request.formData(); const file=form.get('file'); const title=String(form.get('title')||'').trim(); const related=String(form.get('related')||'Other'); if(!(file instanceof File))return fail('PDF file is required.'); if(file.type!=='application/pdf')return fail('Only PDF files are accepted.'); if(file.size>15*1024*1024)return fail('PDF must be 15 MB or smaller.'); if(!title)return fail('Document title is required.'); const uploadId=id('upl'), key=`employees/${s.subject_id}/${uploadId}.pdf`; await storeUpload(key,file); await env.DB.prepare('INSERT INTO uploads (id,employee_id,title,related,file_name,object_key,size,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(uploadId,s.subject_id,title,related,file.name,key,file.size,'Submitted',now()).run(); const emp=await env.DB.prepare('SELECT name FROM employees WHERE id=?').bind(s.subject_id).first(); await notifyAdmin(env,'New PDF uploaded',`${emp?.name||'Employee'} uploaded “${title}”.`); return ok({ok:true});
  }
  if(path.startsWith('/api/employee/uploads/') && method==='GET'){
    const s=await requireEmployee(env,request); if(!s)return fail('Not signed in.',401); const uid=path.split('/').pop(); const row=await env.DB.prepare('SELECT * FROM uploads WHERE id=? AND employee_id=?').bind(uid,s.subject_id).first(); if(!row)return fail('File not found.',404); const obj=await fetchUpload(row.object_key); if(!obj)return fail('File not found.',404); return new Response(obj.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${row.file_name.replaceAll('\"','')}"`}});
  }

  if(path==='/api/admin/login' && method==='POST'){
    const body=await request.json().catch(()=>({})); const email=String(body.email||'').trim().toLowerCase(), password=String(body.password||''); const row=await env.DB.prepare('SELECT * FROM admins WHERE lower(email)=?').bind(email).first(); if(!row || !(await verifyPassword(password,row.password_salt,row.password_hash)))return fail('Incorrect admin email or password.',401); const s=await createSession(env,'admin',row.id); return json({ok:true,admin:{email:row.email}},{headers:{'set-cookie':cookie(s.token,s.maxAge)}});
  }
  if(path==='/api/admin/logout' && method==='POST'){await destroySession(env,request);return json({ok:true},{headers:{'set-cookie':clearCookie()}});}
  if(path==='/api/admin/me' && method==='GET'){const s=await requireAdmin(env,request);if(!s)return fail('Not signed in.',401);const row=await env.DB.prepare('SELECT id,email FROM admins WHERE id=?').bind(s.subject_id).first();return ok({admin:row});}
  if(path==='/api/admin/data' && method==='GET'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);return ok(await listAdminData(env));}
  if(path==='/api/admin/notifications/read' && method==='POST'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);await env.DB.prepare("UPDATE notifications SET is_read=1 WHERE audience='admin'").run();return ok({ok:true});}
  if(path==='/api/admin/employees' && method==='POST'){
    if(!await requireAdmin(env,request))return fail('Not signed in.',401); const b=await request.json().catch(()=>({})); const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),code=String(b.code||'').trim(); if(!name||!/^\S+@\S+\.\S+$/.test(email)||code.length<8)return fail('Name, valid email and an access code of at least 8 characters are required.'); const exists=await env.DB.prepare('SELECT id FROM employees WHERE lower(email)=?').bind(email).first();if(exists)return fail('An employee with that email already exists.',409);const ph=await passwordHash(code);const eid=id('emp');await env.DB.prepare('INSERT INTO employees (id,name,email,access_salt,access_hash,active,chat_enabled,steps_json,docs_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(eid,name,email,ph.salt,ph.hash,b.active===false?0:1,b.chatEnabled===false?0:1,JSON.stringify([false,false,false,false,false,false]),JSON.stringify(DEFAULT_DOCS),now(),now()).run();return ok({employee:{id:eid,name,email,active:b.active!==false,chatEnabled:b.chatEnabled!==false,steps:[false,false,false,false,false,false],docs:DEFAULT_DOCS}});
  }
  if(path.startsWith('/api/admin/employees/') && method==='PUT' && !path.endsWith('/progress') && !path.endsWith('/documents') && !path.endsWith('/chat')){
    if(!await requireAdmin(env,request))return fail('Not signed in.',401); const eid=path.split('/').pop(); const b=await request.json().catch(()=>({})); const row=await env.DB.prepare('SELECT * FROM employees WHERE id=?').bind(eid).first(); if(!row)return fail('Employee not found.',404); const name=String(b.name??row.name).trim(),email=String(b.email??row.email).trim().toLowerCase(); if(!name||!/^\S+@\S+\.\S+$/.test(email))return fail('Valid name and email required.'); let accessSalt=row.access_salt,accessHash=row.access_hash;if(b.code){const ph=await passwordHash(String(b.code));accessSalt=ph.salt;accessHash=ph.hash} await env.DB.prepare('UPDATE employees SET name=?,email=?,access_salt=?,access_hash=?,active=?,chat_enabled=?,updated_at=? WHERE id=?').bind(name,email,accessSalt,accessHash,b.active===false?0:1,b.chatEnabled===false?0:1,now(),eid).run();return ok({ok:true});
  }
  if(path.startsWith('/api/admin/employees/') && method==='DELETE'){
    if(!await requireAdmin(env,request))return fail('Not signed in.',401); const eid=path.split('/').pop(); await env.DB.prepare('DELETE FROM employees WHERE id=?').bind(eid).run(); return ok({ok:true});
  }
  if(path.startsWith('/api/admin/employees/') && path.endsWith('/progress') && method==='PUT'){
    if(!await requireAdmin(env,request))return fail('Not signed in.',401); const eid=path.split('/')[4]; const b=await request.json().catch(()=>({})); const steps=Array.isArray(b.steps)?b.steps.slice(0,6).map(Boolean):null;if(!steps||steps.length!==6)return fail('Six progress steps are required.');await env.DB.prepare('UPDATE employees SET steps_json=?,updated_at=? WHERE id=?').bind(JSON.stringify(steps),now(),eid).run();await notifyEmployee(env,eid,'Application progress updated','Your EverPoint application progress has been updated.');return ok({ok:true});
  }
  if(path.startsWith('/api/admin/employees/') && path.endsWith('/documents') && method==='PUT'){
    if(!await requireAdmin(env,request))return fail('Not signed in.',401); const eid=path.split('/')[4]; const b=await request.json().catch(()=>({})); const docs={...DEFAULT_DOCS,...b.docs}; for(const d of DOCS)if(!['available','pending','locked'].includes(docs[d.id]))return fail('Invalid document status.');await env.DB.prepare('UPDATE employees SET docs_json=?,updated_at=? WHERE id=?').bind(JSON.stringify(docs),now(),eid).run();return ok({ok:true});
  }
  if(path.startsWith('/api/admin/employees/') && path.endsWith('/chat') && method==='PUT'){
    if(!await requireAdmin(env,request))return fail('Not signed in.',401); const eid=path.split('/')[4]; const b=await request.json().catch(()=>({})); const enabled=b.enabled!==false;await env.DB.prepare('UPDATE employees SET chat_enabled=?,updated_at=? WHERE id=?').bind(enabled?1:0,now(),eid).run();await notifyEmployee(env,eid,`Chat ${enabled?'unlocked':'locked'}`,enabled?'Support chat is now available.':'Support chat has been locked by the administrator.');return ok({ok:true});
  }
  if(path==='/api/admin/applications' && method==='GET'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);const rows=await env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();return ok({applications:rows.results});}
  if(path.startsWith('/api/admin/applications/') && method==='PUT'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);const aid=path.split('/').pop();const b=await request.json().catch(()=>({}));const status=String(b.status||'');if(!['New','Reviewing','Shortlisted','Rejected'].includes(status))return fail('Invalid application status.');const a=await env.DB.prepare('SELECT * FROM applications WHERE id=?').bind(aid).first();if(!a)return fail('Application not found.',404);await env.DB.prepare('UPDATE applications SET status=? WHERE id=?').bind(status,aid).run();const emp=await env.DB.prepare('SELECT id FROM employees WHERE lower(email)=lower(?)').bind(a.email).first();if(emp)await notifyEmployee(env,emp.id,'Application status updated',`Your application status is now ${status}.`);return ok({ok:true});}
  if(path.startsWith('/api/admin/applications/') && method==='DELETE'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);await env.DB.prepare('DELETE FROM applications WHERE id=?').bind(path.split('/').pop()).run();return ok({ok:true});}
  if(path.startsWith('/api/admin/chat/') && method==='GET'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);const eid=path.split('/').pop();const rows=await env.DB.prepare('SELECT id,sender,text,created_at FROM messages WHERE employee_id=? ORDER BY created_at ASC').bind(eid).all();return ok({messages:rows.results});}
  if(path.startsWith('/api/admin/chat/') && method==='POST'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);const eid=path.split('/')[4];const emp=await env.DB.prepare('SELECT name,chat_enabled FROM employees WHERE id=?').bind(eid).first();if(!emp)return fail('Employee not found.',404);if(!emp.chat_enabled)return fail('Chat is locked.',403);const b=await request.json().catch(()=>({}));const text=String(b.text||'').trim();if(!text||text.length>1000)return fail('Message must be 1–1000 characters.');await env.DB.prepare('INSERT INTO messages (id,employee_id,sender,text,created_at) VALUES (?,?,?,?,?)').bind(id('msg'),eid,'admin',text,now()).run();await notifyEmployee(env,eid,'New message from EverPoint Admin','You have a new support message from the administrator.');return ok({ok:true});}
  if(path==='/api/admin/uploads' && method==='GET'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);const rows=await env.DB.prepare('SELECT u.id,u.employee_id,u.title,u.related,u.file_name,u.size,u.status,u.created_at,e.name employee_name FROM uploads u JOIN employees e ON e.id=u.employee_id ORDER BY u.created_at DESC').all();return ok({uploads:rows.results});}
  if(path.startsWith('/api/admin/uploads/') && method==='GET'){if(!await requireAdmin(env,request))return fail('Not signed in.',401);const row=await env.DB.prepare('SELECT * FROM uploads WHERE id=?').bind(path.split('/').pop()).first();if(!row)return fail('File not found.',404);const obj=await fetchUpload(row.object_key);if(!obj)return fail('File not found.',404);return new Response(obj.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${row.file_name.replaceAll('"','')}"`}});}
  if(path==='/api/admin/credentials' && method==='PUT'){
    const s=await requireAdmin(env,request);if(!s)return fail('Not signed in.',401);const b=await request.json().catch(()=>({}));const row=await env.DB.prepare('SELECT * FROM admins WHERE id=?').bind(s.subject_id).first();if(!row)return fail('Admin not found.',404);if(!(await verifyPassword(String(b.currentPassword||''),row.password_salt,row.password_hash)))return fail('Current password is incorrect.',401);const email=String(b.email||row.email).trim().toLowerCase(),password=String(b.newPassword||'');if(!/^\S+@\S+\.\S+$/.test(email)||password.length<12)return fail('Use a valid email and a new password of at least 12 characters.');const ph=await passwordHash(password);await env.DB.prepare('UPDATE admins SET email=?,password_salt=?,password_hash=?,updated_at=? WHERE id=?').bind(email,ph.salt,ph.hash,now(),s.subject_id).run();await env.DB.prepare('DELETE FROM sessions WHERE kind=\'admin\' AND id<>?').bind(s.id).run();return ok({ok:true,email});
  }
  return null;
}

// Small D1-style adapter over Netlify Database (Postgres) so the route handlers keep their original SQL.
function d1(pool){
  const prepare=(sql)=>{
    let n=0; const text=sql.replace(/\?/g,()=>`$${++n}`);
    const stmt=(params)=>({
      bind:(...p)=>stmt(p),
      async first(){ const r=await pool.query(text,params); return r.rows[0]||null; },
      async all(){ const r=await pool.query(text,params); return {results:r.rows}; },
      async run(){ const r=await pool.query(text,params); return {meta:{changes:r.rowCount}}; }
    });
    return stmt([]);
  };
  return {prepare};
}

export default async (request) => {
  const url=new URL(request.url);
  const env={DB:d1(getDatabase().pool),SETUP_TOKEN:Netlify.env.get('SETUP_TOKEN'),SESSION_DAYS:Netlify.env.get('SESSION_DAYS')||'7'};
  try{ const r=await api(request,env,url); return r||fail('API route not found.',404); }
  catch(err){ console.error(err); return fail('Server error. Please try again.',500); }
};

export const config = { path: '/api/*' };
