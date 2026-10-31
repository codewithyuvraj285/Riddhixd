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
const f=$('#cf');f&&f.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(f);
const body=`Name: ${d.get('name')}\nCompany: ${d.get('company')}\nEmail: ${d.get('email')}\nInterest: ${d.get('topic')}\n\n${d.get('msg')}`;
location.href='mailto:siddhiworki830@gmail.com?subject='+encodeURIComponent('Website enquiry: '+d.get('topic'))+'&body='+encodeURIComponent(body)});
