import { openStore,root } from '../lib/store.mjs';
import { writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const s=openStore();try{const state=s.state();const dir=resolve(root,'data','backups');mkdirSync(dir,{recursive:true});const file=resolve(dir,'initial-workspace.json');writeFileSync(file,JSON.stringify(state,null,2),'utf8');console.log(JSON.stringify({file,items:state.items.length,comments:state.comments.length,demands:state.demands.length,topics:state.topics.length}));}finally{s.close();}
