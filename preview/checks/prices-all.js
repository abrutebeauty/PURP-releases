const {chromium}=require('playwright');const fs=require('fs');
const ids=JSON.parse(fs.readFileSync('site2/products.json')).products.map(p=>p.id);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:1000}});
p.on('pageerror',e=>console.log('ERR',e.message));
const bad={};
const urls=['/index.html?look=opium2','/bundle.html?look=opium2',...ids.map(i=>'/pack.html?look=opium2&id='+i),'/get.html?look=opium2&id='+ids[0]];
for(const u of urls){await p.goto('http://localhost:8766'+u,{waitUntil:'load'});await p.waitForTimeout(1800);
const t=await p.evaluate(()=>document.body.innerText);
const m=(t.match(/[€$]\s?\d+(?:[.,]\d+)?(?! per)/g)||[]).filter(x=>!/^[€$]\s?(24|48|72)$/.test(x.replace(/\s/g,'')) );
if(m.length) bad[u]=[...new Set(m)]}
console.log(JSON.stringify(bad,null,1));await b.close()})()
