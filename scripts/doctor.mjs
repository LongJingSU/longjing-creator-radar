import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

const checks=[];
const [major,minor]=process.versions.node.split('.').map(Number);
checks.push({name:'Node.js ≥ 22.13（推荐 24 LTS）',ok:major>22||major===22&&minor>=13,detail:process.version});
try {
  const {DatabaseSync}=await import('node:sqlite');
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE health (value TEXT)');db.close();
  checks.push({name:'内置 SQLite',ok:true});
} catch(e) {checks.push({name:'内置 SQLite',ok:false,detail:e.message});}
try {await access(root,constants.W_OK);checks.push({name:'项目目录可写',ok:true});}
catch {checks.push({name:'项目目录可写',ok:false});}
for(const check of checks)console.log(`${check.ok?'✓':'✗'} ${check.name}${check.detail?'：'+check.detail:''}`);
console.log('没有 npm 依赖；无需应用 API key。浏览器权限和定时任务需由你的智能体另外配置。');
process.exitCode=checks.every(c=>c.ok)?0:1;
