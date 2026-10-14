import {uid, canonicalUrl, parseCount} from './domain.mjs';

export const demandPolicy = {minAuthors:5, minSources:2, minLikes:100};
const clean = value => String(value || '').replace(/\s+/g,'').toLowerCase();
const knownAuthor = value => value && !/^(匿名|匿名样本|未知|用户)$/.test(value);
export function evidenceStatus(comment, item) {
  const e=comment.evidence || {};
  let sameSource=false;
  try { sameSource=canonicalUrl(e.pageUrl)===item.canonical; } catch {}
  const captured=Date.parse(e.capturedAt);
  const verified=sameSource && Number.isFinite(captured) && captured<=Date.now()+300000 &&
    !!e.locator && knownAuthor(comment.author) && clean(e.excerpt).includes(clean(comment.text)) && clean(e.excerpt).includes(clean(comment.author));
  const likesVerified=!!verified && !!e.likesText && parseCount(e.likesText)===comment.likes && clean(e.excerpt).includes(clean(e.likesText));
  return {verified:!!verified, likesVerified, reason:verified?'已保存含作者和原话的页面摘录':'缺少可复核的评论页面摘录、采集时间或定位说明'};
}
export function aggregateDemands(comments, items, states={}, policy=demandPolicy) {
  const groups=new Map(), byId=new Map(items.map(i=>[i.id,i]));
  for(const c of comments) {
    const item=byId.get(c.itemId);if(!item)continue;
    const r=c.review, reviewed=r?.status==='reviewed';
    if(reviewed && ['observation','other'].includes(r.intent))continue;
    const semantic=reviewed && ['question','pain','request'].includes(r.intent) && r.subject && r.problem && r.rationale && r.quote && clean(c.text).includes(clean(r.quote));
    if(!semantic&&!c.classification)continue;
    // A broad keyword category never groups unrelated works into one shared problem.
    const key=semantic?uid(item.track+'|'+clean(r.subject)+'|'+clean(r.problem)):uid(item.track+'|pending|'+item.id+'|'+c.classification.key);
    if(!groups.has(key))groups.set(key,{id:key,track:item.track,name:semantic?r.problem:c.classification.name,subject:semantic?r.subject:item.title,type:semantic?({question:'求教程',pain:'吐槽痛点',request:'求资源'}[r.intent]):c.classification.type,semantic,examples:[],platforms:[],status:states[key]||'待选题',lastSeen:c.firstSeen});
    const g=groups.get(key), proof=evidenceStatus(c,item);
    g.examples.push({...c,title:item.title,url:item.url,platform:item.platform,verified:proof.verified,likesVerified:proof.likesVerified,verificationReason:proof.reason,qualifiedEvidence:!!semantic&&proof.verified,review:r||null});
    if(!g.platforms.includes(item.platform))g.platforms.push(item.platform);
    if(c.firstSeen>g.lastSeen)g.lastSeen=c.firstSeen;
  }
  return [...groups.values()].map(g=>{
    const eligible=g.examples.filter(x=>x.qualifiedEvidence);
    const authors=new Set(eligible.filter(x=>knownAuthor(x.author)).map(x=>x.platform+':'+clean(x.author)));
    const sources=new Set(eligible.map(x=>x.itemId));
    const likes=eligible.filter(x=>x.likesVerified).map(x=>x.likes).filter(x=>x!==null&&x!==undefined);
    const maxLikes=likes.length?Math.max(...likes):null;
    const repeated=authors.size>=policy.minAuthors&&sources.size>=policy.minSources;
    const highLiked=maxLikes!==null&&maxLikes>=policy.minLikes;
    const qualified=g.semantic&&(repeated||highLiked);
    const reason=qualified?(repeated?'多位评论者在不同作品提出同一个问题':'一条明确问题获得较多点赞；点赞不等于赞同'):
      !g.semantic?'只匹配到检索词，尚未核对问题含义与上下文':eligible.length===0?'评论出处尚未核验':`证据未达门槛：${authors.size} 个不同署名、${sources.size} 个作品，最高 ${maxLikes??'未知'} 赞`;
    return {...g,count:g.examples.length,sourceCount:new Set(g.examples.map(x=>x.itemId)).size,verifiedCount:eligible.length,authorCount:authors.size,verifiedSourceCount:sources.size,maxLikes,qualified,signal:qualified?(repeated?'多人重复问题':'高赞问题'):'待核验线索',reason,angle:qualified?`围绕「${g.subject}」回应：${g.name}`:null};
  }).sort((a,b)=>Number(b.qualified)-Number(a.qualified)||b.authorCount-a.authorCount||(b.maxLikes??-1)-(a.maxLikes??-1));
}
