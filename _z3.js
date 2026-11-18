const http=require('http');
function req(method,p){return new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:9223,path:p,method},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(new Error(b.slice(0,80)))}})});r.on('error',rej);r.end();})}
(async()=>{
  const tgt = await req('PUT','/json/new?http://127.0.0.1:8012/index.html?cb=fresh2');
  const WS=require('ws');
  const ws=new WS(tgt.webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
  let id=0;const p=new Map();ws.on('message',r=>{const m=JSON.parse(r);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id)}});
  const s=(me,pa={})=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:me,params:pa}))});
  const ev=async e=>{const r=await s('Runtime.evaluate',{expression:e,returnByValue:true,timeout:9000});
    if(r.result&&r.result.exceptionDetails) return 'EXC '+(r.result.exceptionDetails.exception?.description||'').slice(0,110);
    return r.result.result.value;};
  ws.on('message',r=>{const m=JSON.parse(r); if(m.method==='Runtime.exceptionThrown') console.log('EXC:',(m.params.exceptionDetails.exception?.description||'').slice(0,150));});
  await s('Runtime.enable'); await s('Page.enable');
  await new Promise(r=>setTimeout(r,3000));
  console.log('marks:', await ev(`document.querySelectorAll('.col .mark').length`));
  for (const z of ['millennia','centuries','years','months','days']) {
    await s('Runtime.evaluate',{expression:`document.querySelector('#zoomSel').value='${z}';document.querySelector('#zoomSel').dispatchEvent(new Event('change',{bubbles:true}));`});
    await new Promise(r=>setTimeout(r,450));
    console.log(z.padEnd(11), await ev(`(()=>{const k={};document.querySelectorAll('.col .mark').forEach(m=>{const c=m.className.replace('mark ','').replace(' lab','');k[c]=(k[c]||0)+1});return JSON.stringify(k);})()`));
  }
  ws.close();
})();
