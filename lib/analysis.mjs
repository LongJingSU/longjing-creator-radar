// Shared definitions keep filters, cards and exports on the same evidence base.
export function contentSourceUrl(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return '';
    if (['douyin.com', 'www.douyin.com'].includes(u.hostname)) {
      // Search overlays and profile links can lose the selected video on a new tab.
      const id = [u.pathname.match(/^\/video\/(\d+)\/?$/)?.[1], u.searchParams.get('modal_id'), u.searchParams.get('vid')]
        .find(id => /^\d+$/.test(id || ''));
      if (id) return `https://www.douyin.com/video/${id}`;
    }
    // Keep access tokens on Xiaohongshu links and preserve sources without a video ID.
    return u.href;
  } catch { return ''; }
}

export const topicRules = [
  ['AI 办公', /上班|办公|效率|打工|职场|Excel|PPT/i],
  ['AI 视频', /视频|剪辑|混剪|短剧|漫剧|动画|分镜|Seedance|Sora/i],
  ['自媒体变现', /变现|自媒体|涨粉|博主|接单|副业|赚钱/],
  ['AI 编程', /编程|代码|网站|开发|Codex|Claude\s*Code|Cursor/i],
  ['智能体 / Skills', /Agent|智能体|Skills?|WorkBuddy|工作流/i],
  ['AI 眼镜', /眼镜|Ray.?Ban|Rokid/i],
  ['AI 录音', /录音|转写|会议纪要|Plaud/i],
  ['AI 陪伴', /陪伴|玩具|情绪|宠物|机器人/],
  ['ChatGPT', /ChatGPT|GPT[- ]?\d/i],
  ['Claude', /Claude/i],
  ['豆包', /豆包/],
  ['图像与设计', /设计|生图|图片|海报|绘画|修图|Midjourney|即梦/i],
];
export function itemTags(item) {
  return [...new Set([...(item.tags || []), ...topicRules.filter(([, re]) => re.test(item.title || '')).map(([name]) => name)])];
}
export function relativeMultiple(item) {
  const b = item.baseline;
  return b && b.sampleCount >= 5 && b.likes > 0 && b.evidence && item.likes != null ? item.likes / b.likes : null;
}
export function freshness(item, now = new Date().toISOString()) {
  const t=Date.parse(item.publishedAt), current=Date.parse(now), age=current-t;
  if(item.publishedTimeKind!=='published'||!item.publicationEvidence||!Number.isFinite(t)||age<0)return {kind:'unknown',label:'发布时间待核实'};
  if(item.publishedPrecision==='minute'&&age<=864e5)return {kind:'recent24',label:'近 24 小时发布'};
  if(age<=7*864e5)return {kind:'recent7',label:'近 7 天发布'};
  if(item.publishedPrecision!=='minute'&&age<8*864e5)return {kind:'unknown',label:'发布时间在 7 天边界，待核实'};
  return {kind:'historical',label:'历史内容'};
}
export function isGrowing(item, now = new Date().toISOString()) {
  const age=Date.parse(now)-Date.parse(item.lastSeen);
  return item.delta>0 && item.deltaHours>=1 && item.deltaHours<=72 && age>=0 && age<=48*3600e3;
}
export function weeklyTopics(items, now = new Date().toISOString()) {
  const since = Date.parse(now) - 7 * 864e5;
  const groups = new Map();
  for (const x of items.filter(x => x.status !== '已忽略' && Date.parse(x.firstSeen) >= since)) {
    for (const tag of itemTags(x)) {
      if (!groups.has(tag)) groups.set(tag, {name:tag, ids:[], authors:new Set(), platforms:new Set(), likes:0, measured:0});
      const g = groups.get(tag); g.ids.push(x.id);
      if (x.author) g.authors.add(x.platform + ':' + x.author);
      g.platforms.add(x.platform);
      if (x.likes != null) { g.likes += x.likes; g.measured++; }
    }
  }
  return [...groups.values()].filter(g => g.authors.size >= 2).map(g => ({...g,authors:g.authors.size,platforms:[...g.platforms]})).sort((a,b) => b.authors-a.authors || b.likes-a.likes);
}
export function filterItems(items, f, settings, now = new Date().toISOString()) {
  const today = new Date(Date.parse(now) + 8 * 3600e3).toISOString().slice(0,10);
  return items.filter(x => {
    if (f.q && ![x.title,x.author,x.summary,...itemTags(x)].join(' ').toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.track && f.track !== '全部赛道' && x.track !== f.track) return false;
    if (f.platform && f.platform !== '全部平台' && x.platform !== f.platform) return false;
    if (f.author && (x.author !== f.author || x.platform !== f.authorPlatform)) return false;
    if (f.topic && !itemTags(x).includes(f.topic)) return false;
    const recency=freshness(x,now).kind;
    if(f.recency==='priority'&&!['recent24','recent7'].includes(recency)&&!isGrowing(x,now))return false;
    if(f.recency==='recent7'&&!['recent24','recent7'].includes(recency))return false;
    if(['recent24','historical','unknown'].includes(f.recency)&&recency!==f.recency)return false;
    if(f.recency==='growing'&&!isGrowing(x,now))return false;
    if (f.bucket === 'pending' && x.status !== '未处理') return false;
    if (f.bucket === 'pushed' && x.status !== '已推选题') return false;
    if (f.bucket === 'ignored' ? x.status !== '已忽略' : !['all','today'].includes(f.bucket) && x.status === '已忽略') return false;
    if (f.bucket === 'today' && new Date(Date.parse(x.firstSeen) + 8 * 3600e3).toISOString().slice(0,10) !== today) return false;
    const mult = relativeMultiple(x);
    if (f.bucket === 'multiple' && !(mult >= 10)) return false;
    if (f.saved && !x.saved) return false;
    if (f.attribute === '高互动' && !(x.likes != null && x.likes >= settings.likesThreshold)) return false;
    if (f.attribute === '低粉爆款' && !(x.followers != null && x.followers <= 10000 && mult >= 10)) return false;
    if (f.attribute === '异常值' && !(mult >= 10)) return false;
    if (f.attribute === '来自对标' && !x.fromBenchmark) return false;
    return true;
  }).sort((a,b) => f.sort === 'published' ? (freshness(b,now).kind==='unknown'?-Infinity:Date.parse(b.publishedAt))-(freshness(a,now).kind==='unknown'?-Infinity:Date.parse(a.publishedAt)) || (b.likes??-1)-(a.likes??-1) : f.sort === 'latest' ? b.firstSeen.localeCompare(a.firstSeen) : f.sort === 'delta' ? (b.delta ?? -Infinity)-(a.delta ?? -Infinity) : f.sort === 'multiple' ? (relativeMultiple(b) ?? -1)-(relativeMultiple(a) ?? -1) : (b.likes ?? -1)-(a.likes ?? -1));
}
