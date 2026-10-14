import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uid, validateBatch, classify, tracks, safeUrl, validateCommentReview, normalizeEvidence } from './domain.mjs';
import {aggregateDemands, demandPolicy, evidenceStatus} from './demands.mjs';
import {collectionPlan} from './collection-plan.mjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profileKey=value=>{try{const u=new URL(value);return u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}};
export function openStore(path=resolve(root,'data','radar.sqlite')) {
  if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
  const db = new DatabaseSync(path); db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, canonical TEXT UNIQUE NOT NULL, data TEXT NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, run_id TEXT NOT NULL, data TEXT NOT NULL, observed_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS snapshot_item ON snapshots(item_id,observed_at);
  CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, data TEXT NOT NULL, first_seen TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS monitors (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, run_key TEXT UNIQUE, data TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS demand_state (id TEXT PRIMARY KEY, status TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS item_state (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
  const readSetting=(id,fallback)=>{const r=db.prepare('SELECT data FROM settings WHERE id=?').get(id);return r?JSON.parse(r.data):fallback;};
  const writeSetting=(id,data)=>db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(data));
  if(!readSetting('general',null)) {
    writeSetting('general',{enabled:true,time:'12:00',timezone:'Asia/Shanghai',automationId:null,automationStatus:'未注册',likesThreshold:1000,updatedAt:new Date().toISOString()});
    const keywords=[['AI 工具','AI工具、AI Agent、Codex、效率工具'],['AI 自媒体','AI自媒体、AI视频、AI写作、AI工作流'],['AI 硬件','AI硬件、AI眼镜、AI录音笔、AI陪伴']];
    for(const [track,keyword] of keywords) for(const platform of ['小红书','抖音']) {const m={id:uid(platform+track),track,platform,kind:'关键词',name:track,keyword,enabled:true,createdAt:new Date().toISOString()};db.prepare('INSERT OR IGNORE INTO monitors VALUES (?,?)').run(m.id,JSON.stringify(m));}
  }
  function ingest(input) {
    const batch=validateBatch(input); const now=batch.observedAt; const id=batch.runKey?uid(batch.runKey):crypto.randomUUID();
    if(batch.runKey){const prior=db.prepare('SELECT data FROM runs WHERE run_key=?').get(batch.runKey);if(prior)return {...JSON.parse(prior.data),deduplicated:true};}
    let added=0,updated=0,newComments=0,enriched=0;
    db.exec('BEGIN IMMEDIATE');
    try {
      for(const x of batch.items) {
        const old=db.prepare('SELECT data, last_seen FROM items WHERE id=?').get(x.id); const at=x.collectedAt||now;
        const {comments,...data}=x;
        if(batch.metadataOnly){
          if(!old)continue;
          const prior=JSON.parse(old.data),extra={};
          for(const key of ['coverUrl','authorUrl','followers','baseline','tags'])if(data[key]!==undefined)extra[key]=data[key];
          db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify({...prior,...extra,metadataAt:now}),x.id);enriched++;continue;
        }
        if(batch.commentsOnly && !old) throw new Error('补充评论需要已有的内容来源');
        if(!batch.commentsOnly) {
          if(!old) added++; else updated++;
          db.prepare('INSERT INTO items VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=CASE WHEN excluded.last_seen>=items.last_seen THEN excluded.data ELSE items.data END,last_seen=MAX(items.last_seen,excluded.last_seen),first_seen=MIN(items.first_seen,excluded.first_seen)').run(x.id,x.canonical,JSON.stringify({...old?JSON.parse(old.data):{},...data}),at,at);
          db.prepare('INSERT OR IGNORE INTO snapshots VALUES (?,?,?,?,?)').run(uid(x.id+id),x.id,id,JSON.stringify({likes:x.likes,likesText:x.likesText,commentTotal:x.commentTotal}),at);
        }
        for(const c of comments){
          const cid=uid(x.id+c.author+c.text),previous=db.prepare('SELECT data, first_seen FROM comments WHERE id=?').get(cid);
          const prior=previous?JSON.parse(previous.data):{};
          if(previous&&at<(prior.lastSeen||previous.first_seen))continue;
          const next={...prior,...c,id:cid,lastSeen:at,classification:classify(c.text)};
          db.prepare('INSERT INTO comments VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(cid,x.id,JSON.stringify(next),at);
          if(!previous)newComments++;
        }
      }
      const run={id,at:now,source:batch.source,status:batch.issues.length?(batch.items.length?'部分完成':'未采到数据'):'已完成',added,updated,newComments,enriched,metadataOnly:batch.metadataOnly,total:batch.items.length,notes:batch.notes,issues:batch.issues,coverage:batch.coverage};
      db.prepare('INSERT INTO runs VALUES (?,?,?,?)').run(id,batch.runKey||null,JSON.stringify(run),now); db.exec('COMMIT');return run;
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  function state() {
    const topics=db.prepare('SELECT data FROM topics ORDER BY created_at DESC').all().map(r=>JSON.parse(r.data));
    const monitors=db.prepare('SELECT data FROM monitors').all().map(r=>JSON.parse(r.data));
    const itemState=Object.fromEntries(db.prepare('SELECT * FROM item_state').all().map(r=>[r.id,JSON.parse(r.data)]));
    const snapshots=db.prepare('SELECT * FROM snapshots ORDER BY observed_at ASC').all();
    const items=db.prepare('SELECT * FROM items ORDER BY last_seen DESC').all().map(r=>{
      const history=snapshots.filter(s=>s.item_id===r.id).map(s=>({...JSON.parse(s.data),at:s.observed_at}));
      const last=history.at(-1); const prior=last?history.findLast(s=>Date.parse(last.at)-Date.parse(s.at)>=3600e3):null;
      const delta=prior && prior.likes!==null && last.likes!==null ? last.likes-prior.likes:null;
      const x=JSON.parse(r.data),local=itemState[r.id]||{};
      const topic=topics.find(t=>t.sourceType==='item'&&t.sourceId===r.id&&!t.archived);
      const fromBenchmark=monitors.some(m=>m.kind==='账号'&&!m.archived&&m.enabled&&m.platform===x.platform&&profileKey(x.authorUrl)&&profileKey(m.keyword)===profileKey(x.authorUrl));
      return {...x,...local,saved:local.saved===true,status:local.ignored?'已忽略':topic?'已推选题':'未处理',topicId:topic?.id||null,fromBenchmark,firstSeen:r.first_seen,firstRunId:snapshots.find(s=>s.item_id===r.id)?.run_id||null,lastSeen:r.last_seen,history,delta,deltaHours:prior?(Date.parse(last.at)-Date.parse(prior.at))/3600e3:null};
    });
    const comments=db.prepare('SELECT * FROM comments ORDER BY first_seen DESC').all().map(r=>{const c=JSON.parse(r.data),item=items.find(i=>i.id===r.item_id);const proof=item?evidenceStatus(c,item):{verified:false,reason:'缺少作品'};return {...c,classification:classify(c.text),itemId:r.item_id,firstSeen:r.first_seen,platform:item?.platform,url:item?.url,title:item?.title,verified:proof.verified,likesVerified:proof.likesVerified,verificationReason:proof.reason};});
    const demandState=Object.fromEntries(db.prepare('SELECT * FROM demand_state').all().map(r=>[r.id,r.status]));
    const policy={...demandPolicy,...readSetting('demandPolicy',{})};
    const demands=aggregateDemands(comments,items,demandState,policy);
    const settings=readSetting('general',{}),serverTime=new Date().toISOString();
    return {items,comments,demands,demandPolicy:policy,collectionPlan:collectionPlan(monitors,settings.enabled,serverTime),tracks,topics,monitors,deals:db.prepare('SELECT data FROM deals').all().map(r=>JSON.parse(r.data)),runs:db.prepare('SELECT data FROM runs ORDER BY created_at DESC LIMIT 60').all().map(r=>JSON.parse(r.data)),settings,serverTime};
  }
  function saveTopic(body){const title=String(body.title||'').trim();if(!title||title.length>300)throw new Error('选题标题需为 1–300 字');const existing=body.id?db.prepare('SELECT data FROM topics WHERE id=?').get(String(body.id)):null;const old=existing?JSON.parse(existing.data):{};const stages=['待研究','待创作','创作中','已发布']; const topic={...old,id:old.id||crypto.randomUUID(),title,track:tracks.includes(body.track)?body.track:'泛热点',stage:stages.includes(body.stage)?body.stage:(old.stage||'待研究'),notes:String(body.notes||'').slice(0,10000),sourceId:String(body.sourceId||old.sourceId||'').slice(0,100),sourceType:['item','demand'].includes(body.sourceType)?body.sourceType:old.sourceType||'manual',createdAt:old.createdAt||new Date().toISOString()};
    if(topic.sourceType==='demand'&&(!existing||old.sourceId!==topic.sourceId||old.sourceType!=='demand')){
      const d=state().demands.find(d=>d.id===topic.sourceId);
      if(!d?.qualified)throw new Error('需求尚未满足语义复核、出处核验和多人/高赞门槛，不能转为选题');
      topic.demandEvidence={capturedAt:new Date().toISOString(),reason:d.reason,subject:d.subject,problem:d.name,policy:state().demandPolicy,commentIds:d.examples.filter(c=>c.qualifiedEvidence).map(c=>c.id)};
    }
    topic.archived=typeof body.archived==='boolean'?body.archived:old.archived===true;
    topic.draft=String(body.draft??old.draft??'').slice(0,50000);
    topic.publishUrl=body.publishUrl!==undefined?safeUrl(body.publishUrl):old.publishUrl||'';
    if(body.publishUrl&&!topic.publishUrl)throw new Error('发布链接需要有效的 HTTP(S) 地址');
    topic.planDate=String(body.planDate??old.planDate??'').slice(0,10);
    topic.updatedAt=new Date().toISOString();
    if(!body.id&&topic.sourceId){const duplicate=state().topics.find(t=>t.sourceId===topic.sourceId && t.sourceType===topic.sourceType);if(duplicate)return duplicate.archived?saveTopic({...duplicate,archived:false}):duplicate;}
    db.prepare('INSERT INTO topics VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(topic.id,JSON.stringify(topic),topic.createdAt);if(topic.sourceType==='demand')db.prepare('INSERT INTO demand_state VALUES (?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status').run(topic.sourceId,topic.archived?'待选题':'已转选题');return topic;
  }
  function saveMonitor(body){const name=String(body.name||'').trim();const keyword=String(body.keyword||'').trim();if(!name||!keyword||name.length>100||keyword.length>2000)throw new Error('请填写监控名称与关键词/链接');if(!['小红书','抖音'].includes(body.platform))throw new Error('平台无效');if(['账号','单条内容'].includes(body.kind)&&!safeUrl(keyword))throw new Error('账号和单条内容监控需要填写有效的来源链接');const m={id:body.id||crypto.randomUUID(),name,keyword,track:tracks.includes(body.track)?body.track:'泛热点',platform:body.platform,kind:['关键词','账号','单条内容'].includes(body.kind)?body.kind:'关键词',enabled:body.enabled!==false,archived:body.archived===true,createdAt:body.createdAt||new Date().toISOString()};db.prepare('INSERT INTO monitors VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(m.id,JSON.stringify(m));return m;}
  function updateItems(body) {
    const ids=[...new Set(body.ids||[body.id])];
    if(!ids.length||ids.length>500||ids.some(id=>typeof id!=='string'||!db.prepare('SELECT id FROM items WHERE id=?').get(id)))throw new Error('请选中有效的内容记录');
    if(!['ignore','restore','save','unsave','note','topic'].includes(body.action))throw new Error('内容操作无效');
    const before=state(); db.exec('BEGIN IMMEDIATE');
    try { for(const id of ids) {
      const row=db.prepare('SELECT data FROM item_state WHERE id=?').get(id);const local=row?JSON.parse(row.data):{};
      if(body.action==='ignore')local.ignored=true;
      if(body.action==='restore')local.ignored=false;
      if(body.action==='save'||body.action==='unsave')local.saved=body.action==='save';
      if(body.action==='note'){local.note=String(body.note||'').slice(0,10000);local.category=String(body.category||'未分类').slice(0,50);}
      if(body.action==='topic'){const x=before.items.find(x=>x.id===id);saveTopic({title:x.title,track:x.track,sourceType:'item',sourceId:id,notes:`参考来源：${x.url}\n\n我的切入角度：\n需要验证：`});local.ignored=false;}
      local.updatedAt=new Date().toISOString();
      db.prepare('INSERT INTO item_state VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(local));
    }db.exec('COMMIT');return {count:ids.length}; }catch(e){db.exec('ROLLBACK');throw e;}
  }
  function saveDeal(body) {
    const title=String(body.title||'').trim();if(!title||title.length>200)throw new Error('请填写商单名称（最多 200 字）');
    const old=body.id?db.prepare('SELECT data FROM deals WHERE id=?').get(body.id):null;
    const fee=body.fee===''||body.fee==null?null:Number(body.fee);if(fee!==null&&(!Number.isFinite(fee)||fee<0||fee>1e12))throw new Error('金额需要为有效的非负数');
    const deal={...(old?JSON.parse(old.data):{}),id:body.id||crypto.randomUUID(),title,partner:String(body.partner||'').slice(0,200),fee,stage:['待沟通','已确认','制作中','已交付','已回款'].includes(body.stage)?body.stage:'待沟通',dueDate:String(body.dueDate||'').slice(0,10),notes:String(body.notes||'').slice(0,10000),archived:body.archived===true,updatedAt:new Date().toISOString()};
    db.prepare('INSERT INTO deals VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(deal.id,JSON.stringify(deal));return deal;
  }
  function setSettings(body){const old=readSetting('general',{}); const next={...old};if(typeof body.enabled==='boolean')next.enabled=body.enabled;if(body.likesThreshold!==undefined){const n=Number(body.likesThreshold);if(!Number.isFinite(n)||n<0||n>1e9)throw new Error('高互动门槛无效');next.likesThreshold=n;}if(body.automationId!==undefined)next.automationId=String(body.automationId);if(body.automationStatus!==undefined)next.automationStatus=String(body.automationStatus);next.updatedAt=new Date().toISOString();writeSetting('general',next);return next;}
  function reviewComment(body){
    const row=db.prepare('SELECT data FROM comments WHERE id=?').get(String(body.id));if(!row)throw new Error('评论不存在');
    const c=JSON.parse(row.data),review=validateCommentReview(body.review,c.text);if(!review)throw new Error('需要复核结论');
    const next={...c,review:{...review,reviewedAt:new Date().toISOString()},...(body.evidence?{evidence:normalizeEvidence(body.evidence)}:{}),...(body.commentUrl!==undefined?{commentUrl:safeUrl(body.commentUrl)}:{})};
    db.prepare('UPDATE comments SET data=? WHERE id=?').run(JSON.stringify(next),String(body.id));return {id:body.id};
  }
  function setDemandPolicy(body){const next={...demandPolicy,...readSetting('demandPolicy',{})};for(const [key,min,max] of [['minAuthors',2,100],['minSources',2,50],['minLikes',20,100000]]){if(body[key]!==undefined){const n=Number(body[key]);if(!Number.isInteger(n)||n<min||n>max)throw new Error('门槛超出范围：'+key);next[key]=n;}}writeSetting('demandPolicy',next);return next;}
  return {db,ingest,state,saveTopic,saveMonitor,setSettings,setDemandPolicy,reviewComment,updateItems,saveDeal,setDemandStatus(id,status){if(!['待选题','已忽略','已转选题'].includes(status))throw new Error('需求状态无效');if(status==='已转选题'&&!state().demands.find(d=>d.id===id)?.qualified)throw new Error('需求证据不足');db.prepare('INSERT INTO demand_state VALUES (?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status').run(String(id),status);return {id,status};},close(){db.close();}};
}
