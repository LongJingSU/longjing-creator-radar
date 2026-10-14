import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.mjs';
import {classify,normalizeEvidence} from '../lib/domain.mjs';
import {freshness,isGrowing,filterItems} from '../lib/analysis.mjs';
import {collectionPlan} from '../lib/collection-plan.mjs';
import {createServer} from '../server.mjs';

const at='2020-01-02T04:00:00Z', later='2020-01-03T04:00:00Z';
const url=n=>`https://www.douyin.com/video/${10000+n}`;
const text='这个工具的免费额度够剪一条三分钟视频吗？';
const review={intent:'question',subject:'A 工具视频剪辑免费额度',problem:'免费额度能否完成三分钟视频',quote:text,rationale:'原评论明确询问该工具免费额度是否足够完成指定视频长度。'};
const comment=(author,likes=3,n=1)=>({text,author,likes,review,evidence:{pageUrl:url(n),capturedAt:at,locator:`评论区置顶下方，署名 ${author}`,excerpt:`${author}\n${text}\n${likes}`,likesText:String(likes)}});
const item=(n,comments)=>({title:'A 工具剪辑实测',url:url(n),platform:'抖音',track:'AI 自媒体',likes:2000,comments});
function using(fn){const s=openStore(':memory:');try{return fn(s);}finally{s.close();}}

test('reported keyword collisions produce neither demand categories nor angles',()=>{
  for(const t of ['找出遗漏信息、不可逆成本、机会成本，再输出参考建议','想到了就用最低的成本和代价就去做','几年前 copilot 刚出来的时候，我觉得还取代不了我们，现在保留意见，发展速度比我的态度改变的还快'])assert.equal(classify(t),null);
});
test('an unverified comment never creates a topic, regardless of likes or keyword count',()=>using(s=>{
  s.ingest({observedAt:at,items:[item(1,[{text,author:'甲',likes:10000}])]});
  const d=s.state().demands[0];assert.equal(d.qualified,false);assert.equal(d.angle,null);
  assert.throws(()=>s.saveTopic({title:'不能自动出题',sourceType:'demand',sourceId:d.id}),/门槛/);
  assert.throws(()=>s.setDemandStatus(d.id,'已转选题'),/证据/);
}));
test('repeated problems require five distinct names and at least two works',()=>using(s=>{
  s.ingest({observedAt:at,items:[item(1,['甲','乙','丙','丁'].map(a=>comment(a))),item(2,[comment('甲',3,2)])]});
  let d=s.state().demands[0];assert.equal(d.authorCount,4);assert.equal(d.qualified,false);
  s.ingest({observedAt:later,commentsOnly:true,items:[item(2,[comment('戊',3,2)])]});
  d=s.state().demands[0];assert.equal(d.qualified,true);assert.equal(d.authorCount,5);assert.equal(d.verifiedSourceCount,2);assert.equal(d.signal,'多人重复问题');
  const t=s.saveTopic({title:d.angle,sourceType:'demand',sourceId:d.id});assert.equal(t.demandEvidence.commentIds.length,6);
  assert.equal(s.state().demands[0].status,'已转选题');
}));
test('many comments on only one work do not pass the repeated problem gate',()=>using(s=>{
  s.ingest({observedAt:at,items:[item(1,['甲','乙','丙','丁','戊','己'].map(a=>comment(a)))]});assert.equal(s.state().demands[0].qualified,false);
}));
test('high liked explicit questions need numeric evidence, while observations are excluded',()=>using(s=>{
  const c=comment('甲',120);delete c.evidence.likesText;
  s.ingest({observedAt:at,items:[item(1,[c])]});assert.equal(s.state().demands[0].qualified,false);
  s.ingest({observedAt:later,commentsOnly:true,items:[item(1,[comment('甲',120)])]});
  let d=s.state().demands[0];assert.equal(d.signal,'高赞问题');assert.equal(d.maxLikes,120);
  assert.match(d.reason,/不等于赞同/);
  s.reviewComment({id:s.state().comments[0].id,review:{intent:'observation',rationale:'仅是一种感慨，没有具体问题'}});
  assert.equal(s.state().demands.length,0);assert.equal(s.state().comments.length,1);
}));
test('wrong source, future timestamps and paraphrased excerpts cannot establish provenance',()=>{
  for(const proof of [{pageUrl:url(2)},{capturedAt:'2999-01-01T00:00:00Z'},{excerpt:'甲 想知道费用 120'}])using(s=>{
    const c=comment('甲',120);Object.assign(c.evidence,proof);s.ingest({items:[item(1,[c])],observedAt:at});
    assert.equal(s.state().demands[0].qualified,false);assert.equal(s.state().comments[0].verified,false);
  });
});
test('different tool subjects and different problems stay separate',()=>using(s=>{
  const a=comment('甲'),b=comment('乙',3,2);b.review={...review,subject:'B 工具视频剪辑免费额度'};
  s.ingest({items:[item(1,[a]),item(2,[b])],observedAt:at});assert.equal(s.state().demands.length,2);assert.ok(s.state().demands.every(d=>!d.qualified));
}));
test('enrichment keeps one comment, old batches cannot replace proof, direct links are retained',()=>using(s=>{
  s.ingest({observedAt:at,items:[item(1,[{text,author:'甲',likes:null}])]});
  const c=comment('甲',120);c.commentUrl=url(1)+'?comment_id=observed-id';c.evidence.capturedAt=later;
  const r=s.ingest({observedAt:later,commentsOnly:true,items:[item(1,[c])]});assert.equal(r.newComments,0);
  s.ingest({observedAt:at,commentsOnly:true,items:[item(1,[{...c,likes:0,evidence:{}}])]});
  const d=s.state();assert.equal(d.comments.length,1);assert.equal(d.comments[0].likes,120);assert.equal(d.comments[0].evidence.capturedAt,'2020-01-03T04:00:00.000Z');assert.equal(d.comments[0].commentUrl,c.commentUrl);assert.equal(d.items[0].history.length,1);
}));
test('legacy drafts remain editable without claiming qualified evidence',()=>using(s=>{
  const old={id:'old',title:'原草案',notes:'我的原笔记',draft:'已写脚本',stage:'创作中',sourceType:'demand',sourceId:'legacy-demand',createdAt:at};
  s.db.prepare('INSERT INTO topics VALUES (?,?,?)').run(old.id,JSON.stringify(old),at);
  s.saveTopic({...old,title:'继续编辑'});const saved=s.state().topics[0];assert.equal(saved.draft,old.draft);assert.equal(saved.notes,old.notes);assert.equal(saved.stage,'创作中');assert.equal(saved.demandEvidence,undefined);
}));
test('freshness requires publication evidence; first discovery, editing and future dates are not fresh',()=>{
  const now='2026-10-12T04:00:00Z',base={publishedAt:'2026-10-12T02:00:00Z',publicationEvidence:'发布于 2026-10-12 10:00',publishedTimeKind:'published',publishedPrecision:'minute'};
  assert.equal(freshness(base,now).kind,'recent24');assert.equal(freshness({...base,publishedPrecision:'day'},now).kind,'recent7');
  for(const x of [{firstSeen:now,publishedText:'今天'},{...base,publishedTimeKind:'edited'},{...base,publicationEvidence:''},{...base,publishedAt:'2026-10-13T00:00:00Z'}])assert.equal(freshness(x,now).kind,'unknown');
  assert.equal(freshness({...base,publishedAt:'2026-01-01T00:00:00Z'},now).kind,'historical');
  const list=[{...base,id:'fresh',likes:100,status:'未处理'},{id:'old',likes:999999,firstSeen:now,status:'未处理'}];
  assert.deepEqual(filterItems(list,{recency:'recent7'},{likesThreshold:1000},now).map(x=>x.id),['fresh']);
  assert.equal(filterItems(list,{sort:'published'},{},now)[0].id,'fresh');
});
test('growth is a recent positive comparable snapshot, not a stale accumulated increase',()=>{
  const now='2026-10-12T04:00:00Z',x={delta:100,deltaHours:24,lastSeen:'2026-10-12T03:00:00Z'};
  assert.equal(isGrowing(x,now),true);for(const y of [{...x,delta:-1},{...x,delta:null},{...x,deltaHours:240},{...x,lastSeen:'2026-10-09T03:00:00Z'}])assert.equal(isGrowing(y,now),false);
  const rows=[{...x,id:'growing',status:'未处理'},{id:'old-high-likes',likes:999999,status:'未处理',firstSeen:now}];
  assert.deepEqual(filterItems(rows,{recency:'priority'},{},now).map(x=>x.id),['growing']);
});
test('evidence screenshot filenames cannot reach outside the evidence folder',()=>{
  assert.equal(normalizeEvidence({screenshot:'comment-001.jpg'}).screenshot,'comment-001.jpg');
  for(const screenshot of ['../radar.sqlite','C:/private.png','https://example.com/proof.jpg','proof.svg'])assert.equal(normalizeEvidence({screenshot}).screenshot,'');
});
test('collection plans rotate long tails and obey pauses, archives and explicit targets',()=>{
  const m={id:'a',enabled:true,kind:'关键词',keyword:'AI工具、Codex、效率工具',track:'AI 工具',platform:'抖音'};
  const p=collectionPlan([m,{...m,id:'b',enabled:false},{...m,id:'c',archived:true}],true,'2026-10-12T04:00:00Z');
  assert.equal(p.length,1);assert.ok(p[0].queries.length>=3);assert.equal(p[0].maxItemsPerAuthor,2);assert.notDeepEqual(p[0].queries,collectionPlan([m],true,'2026-10-13T04:00:00Z')[0].queries);
  assert.deepEqual(collectionPlan([m],false),[]);assert.equal(collectionPlan([{...m,kind:'账号',keyword:url(1)}])[0].target,url(1));
});
test('HTTP review and thresholds enforce the same gate used by the UI',async()=>{
  const s=openStore(':memory:'),server=createServer(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const post=(path,body)=>fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    s.ingest({items:[item(1,[comment('甲',120)])],observedAt:at});let d=s.state().demands[0];
    assert.equal((await post('demand-policy',{minAuthors:5,minSources:2,minLikes:200})).status,200);
    assert.equal((await post('topics',{title:'不应通过',sourceType:'demand',sourceId:d.id})).status,400);
    assert.equal((await post('demand-policy',{minLikes:0})).status,400);
    assert.equal((await post('comment-reviews',{id:s.state().comments[0].id,review:{...review,quote:'评论里不存在'}})).status,400);
    assert.equal((await post('comment-reviews',{id:s.state().comments[0].id,review:{intent:'observation',rationale:'这是观点'}})).status,200);
    assert.equal(s.state().demands.length,0);
  }finally{await new Promise(r=>server.close(r));s.close();}
});
