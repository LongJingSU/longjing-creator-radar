import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../lib/store.mjs';
import {weeklyTopics,relativeMultiple,filterItems,contentSourceUrl} from '../lib/analysis.mjs';
import {renderCSV} from '../lib/export.mjs';
const sample={title:'AI办公教程',url:'https://www.xiaohongshu.com/explore/abc123',author:'作者一',platform:'小红书',track:'AI 工具',likes:2000};
test('source links open the exact Douyin video from search overlays or profiles',()=>{
  assert.equal(contentSourceUrl('https://www.douyin.com/search/AI%E5%B7%A5%E5%85%B7?modal_id=7645269431458843958&type=general'),'https://www.douyin.com/video/7645269431458843958');
  assert.equal(contentSourceUrl('https://www.douyin.com/user/creator?from_tab_name=main&vid=7629011621527981338'),'https://www.douyin.com/video/7629011621527981338');
  assert.equal(contentSourceUrl('https://www.douyin.com/video/7689005697501179897?from=search'),'https://www.douyin.com/video/7689005697501179897');
});
test('source links retain access parameters and never invent video targets',()=>{
  const urls=['https://www.xiaohongshu.com/search_result/abc123?xsec_token=access-token&xsec_source=pc_search','https://www.douyin.com/search/AI?type=general','https://www.douyin.com/user/creator','https://www.douyin.com/search/AI?modal_id=invalid','https://example.com/?modal_id=12345'];
  for(const url of urls)assert.equal(contentSourceUrl(url),url);
  assert.equal(contentSourceUrl('javascript:alert(1)'),'');
  assert.equal(contentSourceUrl('not a url'),'');
});
test('content lifecycle persists separately from collection and supports atomic batches',()=>{
  const s=openStore(':memory:');try{
    s.ingest({items:[sample]});const id=s.state().items[0].id;
    s.updateItems({id,action:'save'});s.updateItems({id,action:'note',note:'我的笔记',category:'开头钩子'});s.updateItems({id,action:'ignore'});
    s.ingest({items:[{...sample,likes:3000}]});let x=s.state().items[0];assert.equal(x.saved,true);assert.equal(x.note,'我的笔记');assert.equal(x.status,'已忽略');
    assert.throws(()=>s.updateItems({ids:[id,'missing'],action:'restore'}));assert.equal(s.state().items[0].status,'已忽略');
    s.updateItems({id,action:'restore'});assert.equal(s.state().items[0].status,'未处理');
    s.updateItems({id,action:'topic'});s.updateItems({id,action:'topic'});assert.equal(s.state().topics.length,1);assert.equal(s.state().items[0].status,'已推选题');
    const topic=s.state().topics[0];s.saveTopic({...topic,draft:'完整脚本',planDate:'2026-10-11',archived:true});assert.equal(s.state().items[0].status,'未处理');
    s.updateItems({id,action:'topic'});assert.equal(s.state().topics[0].archived,false);assert.equal(s.state().topics[0].draft,'完整脚本');
  }finally{s.close();}
});
test('metadata enrichment cannot fabricate metric snapshots or overwrite content',()=>{
  const s=openStore(':memory:');try{
    s.ingest({items:[sample],observedAt:'2026-10-09T04:00:00Z'});
    const result=s.ingest({metadataOnly:true,items:[{...sample,title:'ignored title change',likes:99999,coverUrl:'https://sns-webpic-qc.xhscdn.com/test.webp'}],observedAt:'2026-10-10T04:00:00Z'});
    const x=s.state().items[0];assert.equal(x.title,sample.title);assert.equal(x.likes,2000);assert.equal(x.history.length,1);assert.equal(x.lastSeen,'2026-10-09T04:00:00.000Z');assert.equal(x.coverUrl,'https://sns-webpic-qc.xhscdn.com/test.webp');assert.equal(result.enriched,1);assert.equal(result.updated,0);
    s.ingest({items:[sample]});assert.equal(s.state().items[0].coverUrl,x.coverUrl);
  }finally{s.close();}
});
test('multiples require evidence and date filters use Beijing midnight',()=>{
  const x={...sample,id:'a',status:'未处理',firstSeen:'2026-10-09T16:10:00Z',followers:100,baseline:{likes:100,sampleCount:5,evidence:'5篇作品点赞中位数'}};
  assert.equal(relativeMultiple(x),20);assert.equal(relativeMultiple({...x,baseline:{...x.baseline,sampleCount:4}}),null);
  assert.equal(relativeMultiple({...x,baseline:{...x.baseline,evidence:''}}),null);
  const settings={likesThreshold:1000},now='2026-10-10T03:00:00Z';
  assert.equal(filterItems([x],{bucket:'today'},settings,now).length,1);
  assert.equal(filterItems([x],{attribute:'低粉爆款'},settings,now).length,1);
  assert.equal(filterItems([{...x,followers:null}],{attribute:'低粉爆款'},settings,now).length,0);
  assert.equal(filterItems([{...x,status:'已忽略'}],{bucket:'pending'},settings,now).length,0);
});
test('topic aggregation requires distinct known authors and excludes ignored content',()=>{
  const base={...sample,firstSeen:'2026-10-10T00:00:00Z',status:'未处理'};
  assert.equal(weeklyTopics([{...base,id:'1'},{...base,id:'2'}],'2026-10-10T04:00:00Z').length,0);
  const groups=weeklyTopics([{...base,id:'1'},{...base,id:'2',author:'作者二'},{...base,id:'3',author:'作者三',status:'已忽略'}],'2026-10-10T04:00:00Z');
  assert.equal(groups[0].authors,2);assert.equal(groups[0].likes,4000);
});
test('monitor validation and reversible deals preserve user records',()=>{
  const s=openStore(':memory:');try{
    assert.throws(()=>s.saveMonitor({name:'账号',platform:'抖音',kind:'账号',keyword:'not a link'}));
    const d=s.saveDeal({title:'AI工具合作',fee:'1200.50',stage:'制作中',notes:'保留备注'});
    s.saveDeal({...d,archived:true});assert.equal(s.state().deals[0].archived,true);
    s.saveDeal({...d,archived:false});assert.equal(s.state().deals[0].notes,'保留备注');assert.equal(s.state().deals[0].fee,1200.5);
  }finally{s.close();}
});
test('exports preserve quotes and neutralize spreadsheet formulas',()=>{
  const text=renderCSV([{title:' =1+1',author:'作者 "A"',likes:null}]);
  assert.ok(text.startsWith('\ufeff'));assert.ok(text.includes('"\' =1+1"'));assert.ok(text.includes('"作者 ""A"""'));
});
test('benchmark matching uses profile identity instead of expiring link parameters',()=>{
  const s=openStore(':memory:');try{
    s.ingest({items:[{...sample,authorUrl:'https://www.xiaohongshu.com/user/profile/abc?xsec_token=new'}]});
    s.saveMonitor({name:'作者一',platform:'小红书',track:'AI 工具',kind:'账号',keyword:'https://www.xiaohongshu.com/user/profile/abc?xsec_token=old'});
    assert.equal(s.state().items[0].fromBenchmark,true);
  }finally{s.close();}
});
