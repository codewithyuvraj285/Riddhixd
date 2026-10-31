/* Carousel arrows for the new home sections (does not touch main.js) */
document.querySelectorAll('.x-arrows').forEach(a=>{const c=a.previousElementSibling,b=a.querySelectorAll('button');
b[0].onclick=()=>c.scrollBy({left:-c.clientWidth/2,behavior:'smooth'});b[1].onclick=()=>c.scrollBy({left:c.clientWidth/2,behavior:'smooth'})});
