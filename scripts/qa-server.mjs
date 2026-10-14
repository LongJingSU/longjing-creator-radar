// Isolated browser acceptance environment: never writes to the user's database.
import {createServer} from '../server.mjs';
import {openStore,root} from '../lib/store.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=await fetch('http://127.0.0.1:4318/api/state').then(r=>r.json());
const store=openStore(':memory:');
store.ingest({source:'界面验证副本',items:source.items.map(x=>({...x,comments:source.comments.filter(c=>c.itemId===x.id)}))});
for(const topic of source.topics)store.saveTopic(topic);
const server=createServer(store);
const app=server.listeners('request')[0];server.removeListener('request',app);
// Save screenshots produced by the supported browser tool through an ordinary
// form, without adding a capture endpoint to the production application.
server.on('request',async(req,res)=>{
  if(req.url!=='/qa-capture')return app(req,res);
  if(!/^(127\.0\.0\.1|localhost):4319$/.test(req.headers.host||'')){res.writeHead(403);return res.end();}
  if(req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(`<!doctype html><html lang="zh-CN"><title>验收截图归档</title><form><label>截图数据<textarea id="image" required></textarea></label><button>保存验收截图</button></form><p role="status"></p><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/qa-capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:document.querySelector('#image').value})});document.querySelector('[role=status]').textContent=await r.text();};</script></html>`);
  }
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:4319'){res.writeHead(403);return res.end();}
  try{let raw='';for await(const c of req){raw+=c;if(raw.length>3e6)throw new Error('Image too large');}const bytes=Buffer.from(JSON.parse(raw).image,'base64');if(bytes[0]!==255||bytes[1]!==216)throw new Error('JPEG expected');const directory=resolve(root,'data','previews');await mkdir(directory,{recursive:true});const path=resolve(directory,'workbench-v2.jpg');await writeFile(path,bytes);res.end(path);}catch(e){res.writeHead(400);res.end(e.message);}
});
server.listen(4319,'127.0.0.1',()=>console.log('QA only http://127.0.0.1:4319'));
