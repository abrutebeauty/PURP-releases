const {chromium}=require('playwright');const fs=require('fs');
const d=JSON.parse(fs.readFileSync('site2/products.json'));d.currency='USD';d.products.forEach(p=>{if(p.price>0)p.priceUsd=p.price===14?14:p.price});
const ids=d.products.map(p=>p.id);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.route('**/api/products*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(d)}));
const bad={};
for(const u of ['/index.html?look=opium2','/bundle.html?look=opium2',...ids.map(i=>'/pack.html?look=opium2&id='+i),...ids.slice(0,3).map(i=>'/get.html?look=opium2&id='+i)]){await p.goto('http://localhost:8766'+u,{waitUntil:'load'});await p.waitForTimeout(1500);
const t=await p.evaluate(()=>document.body.innerText);
const m=(t.match(/[€$]\s?\d+(?:[.,]\d+)?(?! per)/g)||[]).filter(x=>!/^[€$]\s?(24|48|72|0)$/.test(x.replace(/\s/g,'')));
if(m.length) bad[u]=[...new Set(m)]}
console.log('USD scan non-24:',JSON.stringify(bad));await b.close()})()
