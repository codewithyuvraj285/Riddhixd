/* Riddhix inner pages: menu, header hide, carousel, mailto form. (Home page uses main.js.) */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
document.body.classList.add('ready');
const nv=$('#nv'),bm=$('#bm'),hd=$('#hd');
const setMenu=o=>{nv.classList.toggle('open',o);bm.setAttribute('aria-expanded',o);bm.setAttribute('aria-label',o?'Close menu':'Open menu')};
bm.onclick=()=>setMenu(!nv.classList.contains('open'));
nv.addEventListener('click',e=>{if(e.target.closest('a,button'))setMenu(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&nv.classList.contains('open')){setMenu(false);bm.focus()}});
addEventListener('resize',()=>{if(innerWidth>1040)setMenu(false)});
let ly=0;addEventListener('scroll',()=>{const y=scrollY;hd.classList.toggle('hide',y>ly&&y>300&&!nv.classList.contains('open'));ly=y},{passive:true});
$$('.x-arrows').forEach(a=>{const c=a.previousElementSibling,b=$$('button',a);b[0].onclick=()=>c.scrollBy({left:-c.clientWidth/2,behavior:'smooth'});b[1].onclick=()=>c.scrollBy({left:c.clientWidth/2,behavior:'smooth'})});
const f=$('#cf');
const rid=()=>{const a=new Uint8Array(12);(crypto&&crypto.getRandomValues)?crypto.getRandomValues(a):a.forEach((_,k)=>a[k]=Math.random()*256);return[...a].map(b=>b.toString(36).padStart(2,'0')).join('').slice(0,22)};
const clientId=()=>{try{let c=localStorage.getItem('riddhix_client_id');if(!/^[A-Za-z0-9_-]{8,64}$/.test(c||'')){c=rid();localStorage.setItem('riddhix_client_id',c)}return c}catch(e){return rid()}};
f&&f.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(f),C=window.RIDDHIX_CONFIG||{};
const body=`Name: ${d.get('name')}\nCompany: ${d.get('company')||''}\nEmail: ${d.get('email')}\nInterest: ${d.get('topic')||''}\n\n${d.get('msg')}`;
const mail=()=>{location.href='mailto:'+(C.email||'siddhiworki830@gmail.com')+'?subject='+encodeURIComponent('Website enquiry: '+(d.get('topic')||''))+'&body='+encodeURIComponent(body)};
if(!C.leadEndpoint)return mail();   /* no backend yet: open the visitor's mail app as before */
let st=$('#cf-st');if(!st){st=document.createElement('p');st.id='cf-st';st.setAttribute('role','status');st.style.cssText='margin-top:14px;font-weight:600';f.appendChild(st)}
const btn=$('button[type=submit]',f);btn.disabled=true;st.textContent='Sending...';
const cid='CNV-'+rid(),payload={action:'lead',conversation_id:cid,lead_id:'LD-'+rid(),client_id:clientId(),page_url:location.href.split('#')[0],lang:document.documentElement.lang||'en',token:C.clientToken||undefined,
customer:{name:String(d.get('name')||''),email:String(d.get('email')||''),phone:'',email_verified:false,phone_verified:false},project_type:String(d.get('topic')||''),requirements_summary:String(d.get('msg')||''),lead_status:'new',created_at:new Date().toISOString(),consent:true,
messages:[{message_id:'M'+rid(),sender_type:'customer',message_text:body,timestamp:new Date().toISOString()}]};
try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),C.timeoutMs||30000);
const r=await fetch(C.leadEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:ctl.signal});clearTimeout(t);
const j=await r.json();if(!j||!j.ok)throw new Error((j&&j.error)||'failed');
st.textContent='Thank you. Your enquiry is saved and our team will reply within one working day.';f.reset()}
catch(err){st.textContent='Could not send directly, opening your email app instead.';mail()}
finally{btn.disabled=false}});
