const http=require('http');
function g(p){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9223,path:p},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
(async()=>{const t=(await g('/json/list')).find(x=>x.type==='page');const WS=require('ws');
const ws=new WS(t.webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
let id=0;const p=new Map();ws.on('message',r=>{const m=JSON.parse(r);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id)}});
const s=(me,pa={})=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:me,params:pa}))});
const ev=async e=>{const r=await s('Runtime.evaluate',{expression:e,returnByValue:true});
  if(r.result&&r.result.exceptionDetails) return 'EXC '+(r.result.exceptionDetails.exception?.description||'').slice(0,90);
  return r.result.result.value;};
await s('Page.enable');
await s('Page.navigate',{url:'http://127.0.0.1:8012/index.html?cb=z4'});
await new Promise(r=>setTimeout(r,2500));
console.log('fit marks:', await ev(`document.querySelectorAll('.col .mark').length`));
for (const z of ['millennia','centuries','years','months','days']) {
  await s('Runtime.evaluate',{expression:`document.querySelector('#zoomSel').value='${z}';document.querySelector('#zoomSel').dispatchEvent(new Event('change',{bubbles:true}));`});
  await new Promise(r=>setTimeout(r,500));
  console.log(z.padEnd(11), await ev(`(()=>{const k={};document.querySelectorAll('.col .mark').forEach(m=>{const c=m.className.replace('mark ','').replace(' lab','');k[c]=(k[c]||0)+1});return JSON.stringify(k);})()`));
}
ws.close()})();
