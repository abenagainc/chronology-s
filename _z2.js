const http=require('http');
function g(p){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9223,path:p},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
(async()=>{const t=(await g('/json/list')).find(x=>x.type==='page');const WS=require('ws');
const ws=new WS(t.webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
let id=0;const p=new Map();ws.on('message',r=>{const m=JSON.parse(r);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id)}});
const s=(me,pa={})=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:me,params:pa}))});
const ev=async e=>{const r=await s('Runtime.evaluate',{expression:e,returnByValue:true,timeout:8000});
  if(r.result&&r.result.exceptionDetails) return 'EXC '+(r.result.exceptionDetails.exception?.description||JSON.stringify(r.result.exceptionDetails)).slice(0,120);
  return r.result.result.value;};
ws.on('message',r=>{const m=JSON.parse(r); if(m.method==='Runtime.exceptionThrown') console.log('PAGE EXC:', (m.params.exceptionDetails.exception?.description||'').slice(0,200));});
await s('Runtime.enable'); await s('Page.enable');
console.log('navigating...');
await s('Page.navigate',{url:'http://127.0.0.1:8012/index.html?cb=z5'});
await new Promise(r=>setTimeout(r,3000));
console.log('marks:', await ev(`document.querySelectorAll('.col .mark').length`));
console.log('done');
ws.close()})();
