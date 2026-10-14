// Temporary localhost form for archiving browser-observed collection batches.
// Run explicitly for a date, submit once through the browser, then stop it.
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateBatch} from '../lib/domain.mjs';
const day=process.argv[2];
if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))throw new Error('Pass YYYY-MM-DD');
let origin;
const file=resolve(import.meta.dirname,'../inbox',day+'.json');
const html='<!doctype html><meta charset="utf-8"><title>采集批次归档</title><h1>采集批次归档</h1><p>将本轮实际读取的公开内容保存为本机 JSON，随后由采集脚本校验入库。</p><form method="post"><label>采集批次 JSON<textarea name="batch" rows="16" cols="100" required></textarea></label><p><button type="submit">保存本轮批次</button></p></form>';
const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(req.headers.host!==new URL(origin).host||req.url!=='/'){res.writeHead(404);return res.end('Not found');}
  if(req.method==='GET')return res.end(html);
  if(req.method!=='POST'||req.headers.origin!==origin){res.writeHead(403);return res.end('Forbidden');}
  try{
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>3e6)throw new Error('Batch too large');}
    const batch=JSON.parse(new URLSearchParams(body).get('batch'));
    validateBatch(batch);
    if(batch.runKey!=='daily-'+day)throw new Error('Unexpected runKey');
    mkdirSync(resolve(import.meta.dirname,'../inbox'),{recursive:true});
    writeFileSync(file,JSON.stringify(batch,null,2)+'\n',{encoding:'utf8',flag:'wx'});
    res.end('<h1>批次已归档</h1><p>'+batch.items.length+' 条内容。文件：'+file+'</p><p>尚未入库，等待采集脚本校验。</p>');
  }catch(e){res.writeHead(400);res.end('<h1>归档失败</h1><pre>'+String(e.message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre>');}
});
server.listen(0,'127.0.0.1',()=>{origin='http://127.0.0.1:'+server.address().port;console.log(origin);});
