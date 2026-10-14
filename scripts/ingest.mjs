import { readFileSync } from 'node:fs';
import { openStore } from '../lib/store.mjs';
const file=process.argv[2];if(!file){console.error('用法: node scripts/ingest.mjs <本轮JSON文件>');process.exit(1);}
const store=openStore();try{const input=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')); console.log(JSON.stringify(store.ingest(input),null,2));}catch(e){console.error(e.message);process.exitCode=1;}finally{store.close();}
