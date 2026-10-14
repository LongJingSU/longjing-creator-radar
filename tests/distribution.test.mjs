import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {openStore} from '../lib/store.mjs';
import {createServer} from '../server.mjs';
import {seedDemo} from '../examples/demo-data.mjs';

test('fresh install has empty personal data and no registered scheduler',()=>{
  const s=openStore(':memory:');
  try {
    const state=s.state();
    for(const key of ['items','comments','topics','deals','runs'])assert.equal(state[key].length,0);
    assert.equal(state.settings.automationId,null);
    assert.equal(state.monitors.filter(m=>m.enabled).length,6);
  } finally{s.close();}
});

test('demo fixture illustrates both evidence paths without changing a separate store',()=>{
  const personal=openStore(':memory:'),demo=openStore(':memory:');
  try {
    personal.saveTopic({title:'用户的稿件',draft:'保留这份草稿',stage:'创作中'});
    seedDemo(demo);
    const state=demo.state();
    assert.deepEqual(state.demands.filter(d=>d.qualified).map(d=>d.signal).sort(),['多人重复问题','高赞问题'].sort());
    assert.equal(state.demands.filter(d=>!d.qualified).length,2);
    assert.equal(state.settings.automationId,null);
    for(const item of state.items){assert.match(item.url,/^https:\/\/example\.com\/longjing-demo\//);assert.match(item.evidence,/演示/);if(item.publishedAt)assert.ok(Date.parse(item.firstSeen)>=Date.parse(item.publishedAt));}
    assert.equal(personal.state().items.length,0);
    assert.equal(personal.state().topics[0].draft,'保留这份草稿');
  } finally{demo.close();personal.close();}
});

test('demo HTTP exports and evidence use their isolated artifact directory',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'longjing-isolation-test-'));
  const s=seedDemo(openStore(':memory:'));
  const server=createServer(s,{demo:true,storageRoot:directory});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    assert.equal((await fetch(base+'/api/state').then(r=>r.json())).demo,true);
    assert.equal((await fetch(base+'/api/health').then(r=>r.json())).demo,true);
    const exported=await fetch(base+'/api/export-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'backup'})}).then(r=>r.json());
    assert.equal(resolve(exported.path),resolve(directory,'data','exports',exported.filename));
    assert.equal(JSON.parse(await readFile(exported.path,'utf8')).items.length,16);
    assert.equal((await fetch(base+exported.downloadUrl)).status,200);
    await mkdir(join(directory,'data','evidence'),{recursive:true});
    await writeFile(join(directory,'data','evidence','test.jpg'),'fixture-image');
    assert.equal(await fetch(base+'/api/evidence/test.jpg').then(r=>r.text()),'fixture-image');
    assert.equal((await fetch(base+'/api/evidence/missing.jpg')).status,404);
  } finally {await new Promise(r=>server.close(r));s.close();await rm(directory,{recursive:true,force:true});}
});
