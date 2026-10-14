import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {createServer} from '../server.mjs';
import {seedDemo} from '../examples/demo-data.mjs';

const store=seedDemo(openStore(':memory:'));
const port=Number(process.env.DEMO_PORT||4320);
const storageRoot=resolve(tmpdir(),'longjing-demo-'+process.pid);
const server=createServer(store,{demo:true,storageRoot});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`演示端口 ${port} 已占用，可设置 DEMO_PORT。`:e.message);store.close();process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  console.log(`龙井演示 http://127.0.0.1:${port}`);
  console.log('全部内容、评论和证据为虚构教学数据；内存运行，关闭后丢弃。不会读取或修改正式数据库。');
  console.log(`演示导出仅保存到临时目录：${storageRoot}`);
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
