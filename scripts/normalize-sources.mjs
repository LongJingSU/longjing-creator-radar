import { openStore } from '../lib/store.mjs';
import { canonicalUrl, uid } from '../lib/domain.mjs';
const store=openStore();const db=store.db;
try {
  db.exec('BEGIN IMMEDIATE');let changed=0;
  for(const row of db.prepare('SELECT * FROM items').all()) {
    const value=JSON.parse(row.data);const canonical=canonicalUrl(value.url);const id=uid(canonical);
    if(row.id===id)continue;
    if(db.prepare('SELECT id FROM items WHERE id=?').get(id))throw new Error('规范化遇到重复来源，请人工合并');
    db.prepare('UPDATE items SET id=?,canonical=?,data=? WHERE id=?').run(id,canonical,JSON.stringify({...value,id,canonical}),row.id);
    for(const snap of db.prepare('SELECT * FROM snapshots WHERE item_id=?').all(row.id)) db.prepare('UPDATE snapshots SET id=?,item_id=? WHERE id=?').run(uid(id+snap.run_id),id,snap.id);
    for(const rowc of db.prepare('SELECT * FROM comments WHERE item_id=?').all(row.id)){const c=JSON.parse(rowc.data);const cid=uid(id+c.author+c.text);db.prepare('UPDATE comments SET id=?,item_id=?,data=? WHERE id=?').run(cid,id,JSON.stringify({...c,id:cid}),rowc.id);}
    for(const rowt of db.prepare('SELECT * FROM topics').all()){const t=JSON.parse(rowt.data);if(t.sourceType==='item'&&t.sourceId===row.id)db.prepare('UPDATE topics SET data=? WHERE id=?').run(JSON.stringify({...t,sourceId:id}),t.id);}
    changed++;
  }
  db.exec('COMMIT');console.log(JSON.stringify({normalized:changed}));
} catch(e){db.exec('ROLLBACK');throw e;}finally{store.close();}
