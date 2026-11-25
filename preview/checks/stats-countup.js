const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.goto('http://localhost:8766/index.html?look=opium2',{waitUntil:'commit'});
const out=[];const t0=Date.now();
for(let i=0;i<24;i++){out.push([Date.now()-t0,await p.evaluate(()=>{const s=document.querySelector('#stats');return s?[...s.querySelectorAll('b')].map(b=>b.textContent+(getComputedStyle(b).visibility==='hidden'?'(h)':'')).join(' | '):'-'})]);await p.waitForTimeout(220)}
console.log(out.map(x=>x.join('ms  ')).join('\n'));await b.close()})()
