/* Carousel arrows for the new home sections (does not touch main.js) */
document.querySelectorAll('.x-arrows').forEach(a=>{const c=a.previousElementSibling,b=a.querySelectorAll('button');
b[0].onclick=()=>c.scrollBy({left:-c.clientWidth/2,behavior:'smooth'});b[1].onclick=()=>c.scrollBy({left:c.clientWidth/2,behavior:'smooth'})});

/* Hero "Read more" fold */
(function(){const b=document.querySelector('[data-more]'),h=document.querySelector('.hero');if(!b||!h)return;
b.addEventListener('click',()=>{const o=h.classList.toggle('open');b.setAttribute('aria-expanded',o)});})();
/* Blogs: one card at a time on phones (dots + arrows) */
(function(){const g=document.getElementById('blg');if(!g)return;const cs=[...g.children],d=g.parentNode.querySelector('.bl-d'),p=g.parentNode.querySelector('.bl-p'),n=g.parentNode.querySelector('.bl-n');
cs.forEach((c,i)=>{const t=document.createElement('button');t.type='button';t.setAttribute('role','tab');t.setAttribute('aria-label','Blog '+(i+1));t.onclick=()=>go(i);d.appendChild(t)});
const dots=[...d.children];let cur=0;
const go=i=>{i=Math.max(0,Math.min(cs.length-1,i));g.scrollTo({left:cs[i].offsetLeft-g.offsetLeft,behavior:'smooth'})};
const sync=()=>{cur=Math.round(g.scrollLeft/(cs[0].offsetWidth+14))||0;cur=Math.max(0,Math.min(cs.length-1,cur));dots.forEach((t,i)=>t.setAttribute('aria-selected',i===cur));p.disabled=cur===0;n.disabled=cur===cs.length-1};
p.onclick=()=>go(cur-1);n.onclick=()=>go(cur+1);g.addEventListener('scroll',()=>requestAnimationFrame(sync),{passive:true});addEventListener('resize',sync);sync();})();
