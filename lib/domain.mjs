import { createHash } from 'node:crypto';
export const tracks = ['AI 工具', 'AI 自媒体', 'AI 硬件'];
export const uid = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function canonicalUrl(value) {
  const safe = safeUrl(value); if (!safe) throw new Error('来源必须是有效的 HTTP(S) 链接');
  const u = new URL(safe); u.hash = '';
  if (u.hostname.endsWith('xiaohongshu.com')) { const id = u.pathname.match(/\/(?:explore|search_result)\/([a-f\d]+)/)?.[1]; if (id) return `https://www.xiaohongshu.com/explore/${id}`; }
  if (u.hostname === 'www.douyin.com' || u.hostname === 'douyin.com') { const id=u.searchParams.get('modal_id') || u.pathname.match(/^\/video\/(\d+)$/)?.[1]; if(id && /^\d+$/.test(id)) return `https://www.douyin.com/video/${id}`; }
  ['utm_source','utm_medium','utm_campaign','source','xsec_token','xsec_source','modal_id'].forEach(k => { if(k !== 'modal_id' || !u.hostname.endsWith('douyin.com')) u.searchParams.delete(k); });
  return u.href;
}
export function parseCount(v) {
  if (v === undefined || v === null || v === '' || v === '赞' || v === '未知') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  const m = String(v).replace(/,/g,'').trim().match(/^(\d+(?:\.\d+)?)\s*([万亿wWkK]?)\+?$/);
  return m ? Math.round(Number(m[1]) * ({万:1e4,亿:1e8,w:1e4,W:1e4,k:1e3,K:1e3}[m[2]] || 1)) : null;
}
export function classify(text) {
  // Retrieval hints only. Neither these matches nor their counts create a topic.
  if(/机会成本|不可逆成本|最低的成本|取代不了|发展速度比/.test(text))return null;
  const rules = [
    ['cost','付费问题线索','吐槽痛点',/付费|订阅|收费|积分|套餐|token.*(?:贵|花|钱)|(?:免费|价格).*(?:吗|多少|够|优势)|(?:太|好)贵/i],
    ['access','安装使用线索','求教程',/(?:怎么|如何|哪里|不会|无法|失败|不了|不能).*(?:下载|安装|登录|注册)|(?:下载|安装|登录).*(?:失败|不了|吗|怎么)/],
    ['quality','效果问题线索','吐槽痛点',/变形|不稳定|幻觉|不好用|看不懂|有问题|有错误/],
    ['choice','选型问题线索','求教程',/哪个好|选哪个|怎么选|有啥区别|有什么区别|推荐.*(?:吗|哪个)/],
    ['resource','资源请求线索','求资源',/求分享|求资源|求.*(?:模板|提示词|链接|源码)|(?:模板|提示词|源码).*(?:哪|吗|分享)/],
    ['privacy','硬件体验线索','吐槽痛点',/(?:隐私|录音|电池|续航|发热|佩戴|重量).*(?:吗|怎么|问题|差|重|担心)/],
    ['earning','效率问题线索','求教程',/(?:怎么|如何).*(?:变现|赚钱|接单|省时间)|(?:变现|赚钱|工作流).*(?:吗|怎么|问题)/],
    ['learning','操作提问线索','求教程',/怎么|如何|步骤|教我|学不会|数据来源.*问题/]
  ];
  const hit=rules.find(r=>r[3].test(text)); return hit?{key:hit[0],name:hit[1],type:hit[2],needsReview:true}:null;
}
export function validateBatch(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.items)) throw new Error('需要包含 items 数组的 JSON');
  if (body.items.length>500) throw new Error('每轮最多 500 条内容');
  let commentCount=0;
  const items=body.items.map(x=>{
    if (!x || typeof x.title!=='string' || !x.title.trim() || x.title.length>500) throw new Error('内容标题不能为空且不能超过 500 字');
    if (!['小红书','抖音','公开资讯'].includes(x.platform)) throw new Error('平台应为小红书、抖音或公开资讯');
    const canonical=canonicalUrl(x.url);
    const comments=(x.comments || []).map(c=>{if(!c || typeof c.text!=='string' || !c.text.trim() || c.text.length>4000) throw new Error('评论内容无效或超过 4000 字'); return {text:c.text.trim(),author:String(c.author||'匿名样本').slice(0,100),likes:parseCount(c.likes),publishedText:String(c.publishedText||'').slice(0,100),...(c.evidence?{evidence:normalizeEvidence(c.evidence)}:{}),...(c.review?{review:validateCommentReview(c.review,c.text)}:{}),...(c.commentUrl?{commentUrl:safeUrl(c.commentUrl)}:{}),...(c.sourceCommentId?{sourceCommentId:String(c.sourceCommentId).slice(0,100)}:{})};});
    commentCount+=comments.length;
    const extra={};
    for(const key of ['query','searchSort','publicationEvidence'])if(x[key]!==undefined)extra[key]=String(x[key]).slice(0,1000);
    if(x.publishedAt!==undefined)extra.publishedAt=Number.isFinite(Date.parse(x.publishedAt))?new Date(x.publishedAt).toISOString():null;
    if(x.publishedTimeKind!==undefined)extra.publishedTimeKind=['published','edited'].includes(x.publishedTimeKind)?x.publishedTimeKind:'unknown';
    if(x.publishedPrecision!==undefined)extra.publishedPrecision=x.publishedPrecision==='minute'?'minute':'day';
    if (x.coverUrl !== undefined) extra.coverUrl=safeUrl(x.coverUrl);
    if (x.authorUrl !== undefined) extra.authorUrl=safeUrl(x.authorUrl);
    if (x.followers !== undefined) extra.followers=parseCount(x.followers);
    if (x.tags !== undefined) extra.tags=Array.isArray(x.tags)?x.tags.slice(0,12).map(t=>String(t).slice(0,50)):[];
    if (x.baseline !== undefined) extra.baseline=x.baseline && parseCount(x.baseline.likes)>0 && parseCount(x.baseline.sampleCount)>=5 && x.baseline.evidence ? {likes:parseCount(x.baseline.likes),sampleCount:parseCount(x.baseline.sampleCount),evidence:String(x.baseline.evidence).slice(0,1000)}:null;
    return {id:uid(canonical),canonical,url:safeUrl(x.url),title:x.title.trim(),platform:x.platform,track:tracks.includes(x.track)?x.track:'泛热点',author:String(x.author||'').slice(0,100),publishedText:String(x.publishedText||'未知').slice(0,100),likes:parseCount(x.likes??x.likesText),likesText:String(x.likesText??x.likes??'未知').slice(0,30),commentTotal:parseCount(x.commentTotal),collectedAt:x.collectedAt && !Number.isNaN(Date.parse(x.collectedAt))?new Date(x.collectedAt).toISOString():null,summary:String(x.summary||'').slice(0,2000),evidence:String(x.evidence||'页面可见内容').slice(0,500),...extra,comments};
  });
  if(commentCount>5000) throw new Error('每轮最多 5000 条评论');
  return {items,coverage:Array.isArray(body.coverage)?body.coverage.slice(0,100).map(c=>({platform:String(c.platform||'').slice(0,20),track:String(c.track||'').slice(0,30),query:String(c.query||'').slice(0,200),sort:String(c.sort||'').slice(0,50),outcome:String(c.outcome||'').slice(0,1000)})):[],metadataOnly:body.metadataOnly===true,commentsOnly:body.commentsOnly===true,notes:String(body.notes||'').slice(0,5000),issues:Array.isArray(body.issues)?body.issues.slice(0,30).map(x=>String(x).slice(0,1000)):[],source:String(body.source||'人工导入').slice(0,100),runKey:String(body.runKey||'').slice(0,100),observedAt:body.observedAt && !Number.isNaN(Date.parse(body.observedAt))?new Date(body.observedAt).toISOString():new Date().toISOString()};
}

const reviewText=value=>String(value||'').replace(/\s+/g,'').toLowerCase();
export function validateCommentReview(value, text) {
  if(!value || typeof value!=='object')return undefined;
  const intent=['question','pain','request','observation','other'].includes(value.intent)?value.intent:'other';
  const result={status:'reviewed',intent,subject:String(value.subject||'').trim().slice(0,150),problem:String(value.problem||'').trim().slice(0,200),rationale:String(value.rationale||'').trim().slice(0,1500),quote:String(value.quote||'').trim().slice(0,1000)};
  if(!result.rationale)throw new Error('请说明为什么归为这个问题，或为什么不是需求');
  if(['question','pain','request'].includes(intent)&&(!result.subject||!result.problem||!result.quote||!reviewText(text).includes(reviewText(result.quote))))throw new Error('需求复核需填写具体对象、具体问题及评论中存在的原句');
  return result;
}
export function normalizeEvidence(value) {
  if(!value||typeof value!=='object')return undefined;
  return {pageUrl:safeUrl(value.pageUrl),capturedAt:Number.isFinite(Date.parse(value.capturedAt))?new Date(value.capturedAt).toISOString():'',locator:String(value.locator||'').trim().slice(0,1500),excerpt:String(value.excerpt||'').slice(0,12000),likesText:String(value.likesText||'').trim().slice(0,30),screenshot:/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}\.(?:png|jpg|jpeg|webp)$/.test(value.screenshot||'')?value.screenshot:''};
}
