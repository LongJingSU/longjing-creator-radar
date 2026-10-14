import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openStore, root } from './lib/store.mjs';
import { saveExport } from './lib/export.mjs';
export function createServer(store=openStore(), options={}) {
  const storageRoot=resolve(options.storageRoot||root);
  const files={'/demands.js':['demands.js','text/javascript; charset=utf-8'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/discovery.js':['discovery.js','text/javascript; charset=utf-8'],'/extensions.js':['extensions.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
  return http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      const host=req.headers.host||'';if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return send(403,{error:'仅允许本机访问'});
      const url=new URL(req.url,'http://'+host);
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.xhscdn.com https://*.douyinpic.com https://*.byteimg.com https://*.douyincdn.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      if(req.method==='GET'){
        if(url.pathname==='/api/state')return send(200,{...store.state(),...(options.demo?{demo:true}:{})});
        if(url.pathname==='/api/health')return send(200,{ok:true,app:'chenxi-creator-radar',name:'龙井自媒体工作台',demo:options.demo===true});
        if(/^\/api\/evidence\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}\.(png|jpg|jpeg|webp)$/.test(url.pathname)){
          const name=url.pathname.split('/').at(-1);
          try{const bytes=await readFile(resolve(storageRoot,'data','evidence',name));res.writeHead(200,{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg','Cache-Control':'no-cache'});res.end(bytes);}catch{return send(404,{error:'尚未保存这张采集截图'});}return;
        }
        if(url.pathname==='/model.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});res.end(await readFile(resolve(root,'lib/analysis.mjs')));return;}
        if(url.pathname==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="chenxi-backup.json"');return send(200,store.state());}
        if(/^\/api\/exports\/chenxi-\d+-[a-f\d]{8}\.(csv|txt|json)$/.test(url.pathname)){
          const name=url.pathname.split('/').at(-1);const bytes=await readFile(resolve(storageRoot,'data','exports',name));
          res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'});res.end(bytes);return;
        }
        if(files[url.pathname]){const [name,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(await readFile(resolve(root,'public',name)));return;}
        return send(404,{error:'页面不存在'});
      }
      if(req.method!=='POST')return send(405,{error:'不支持的请求'});
      if(req.headers.origin && !['http://127.0.0.1:'+req.socket.localPort,'http://localhost:'+req.socket.localPort].includes(req.headers.origin))return send(403,{error:'来源校验失败'});
      if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'需要 JSON 格式'});
      let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>3e6)return send(413,{error:'导入文件不能超过 3 MB'});}
      let body;try{body=JSON.parse(raw);}catch{return send(400,{error:'JSON 格式不正确'});}
      if(url.pathname==='/api/import')return send(200,store.ingest(body));
      if(url.pathname==='/api/export-file')return send(200,await saveExport(storageRoot,store.state(),body));
      if(url.pathname==='/api/topics')return send(200,store.saveTopic(body));
      if(url.pathname==='/api/items')return send(200,store.updateItems(body));
      if(url.pathname==='/api/deals')return send(200,store.saveDeal(body));
      if(url.pathname==='/api/monitors')return send(200,store.saveMonitor(body));
      if(url.pathname==='/api/settings')return send(200,store.setSettings(body));
      if(url.pathname==='/api/demands')return send(200,store.setDemandStatus(body.id,body.status));
      if(url.pathname==='/api/comment-reviews')return send(200,store.reviewComment(body));
      if(url.pathname==='/api/demand-policy')return send(200,store.setDemandPolicy(body));
      return send(404,{error:'接口不存在'});
    }catch(e){send(400,{error:e.message||'操作失败'});}
  });
}
if(process.argv[1] && resolve(process.argv[1])===resolve(root,'server.mjs')) {
  const port=Number(process.env.PORT||4318); const server=createServer();
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已占用，请检查已有工作台或通过 PORT 指定其他端口。`:e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`龙井工作台 http://127.0.0.1:${port}`));
}
