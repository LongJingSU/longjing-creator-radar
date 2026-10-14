import {itemTags,relativeMultiple,weeklyTopics,filterItems,freshness,isGrowing} from '/model.js';

export function contentCards(C, list) {
  const {data,filters,btn,badge,icon,fmt,esc}=C;
  return `<div class="discovery-grid">${list.map(x=>{
    const multiple=relativeMultiple(x), fresh=freshness(x,data.serverTime);
    const cover=x.coverUrl&&/^https:\/\/[^/]+\.(xhscdn\.com|douyinpic\.com|byteimg\.com|douyincdn\.com)\//.test(x.coverUrl)?x.coverUrl:'';
    return `<article class="viral-card ${C.selected.has(x.id)?'is-selected':''}">
      <div class="cover-wrap"><button class="cover-button tone-${data.tracks.indexOf(x.track)}" data-action="item" data-id="${x.id}" aria-label="查看：${esc(x.title)}">
        <span class="cover-fallback"><span class="cover-kicker">${esc(x.track)} / 内容线索</span><strong>${esc(x.title.slice(0,50))}</strong><span class="cover-caption">文字预览 · 原始封面待采集</span></span>
        ${cover?`<img src="${esc(cover)}" loading="lazy" alt="${esc(x.title)}的原始封面" referrerpolicy="no-referrer">`:''}
        <span class="cover-badge">${multiple!==null?'基准 ×'+multiple.toFixed(1):x.likes>=data.settings.likesThreshold?'高互动样本':x.track==='泛热点'?'泛流量话题':'待观察'}</span>
      </button><label class="card-checkbox"><input type="checkbox" data-select-item="${x.id}" aria-label="选择：${esc(x.title)}" ${C.selected.has(x.id)?'checked':''}></label></div>
      <div class="viral-card-body">${btn(esc(x.title),'item','card-title',x.id)}
      <div class="creator-line"><span class="platform-dot ${x.platform==='小红书'?'red':'cyan'}"></span><span>${esc(x.platform)} · ${esc(x.author||'作者未提供')}</span></div>
      <div class="metric-line"><span>${icon('heart')} <b>${esc(x.likesText)}</b></span><span>粉丝 ${fmt(x.followers)}</span></div>
      <div class="freshness-line">${badge(fresh.label,fresh.kind.startsWith('recent')?'mint':'')}${isGrowing(x,data.serverTime)?badge('近期快照增长','mint'):''}<small>${isGrowing(x,data.serverTime)?`快照 +${fmt(x.delta)} 赞 / ${x.deltaHours.toFixed(1)} 小时 · ${C.when(x.lastSeen)}`:`首次采集 ${C.when(x.firstSeen)}`}</small></div><div class="tag-line">${badge(x.track)}${x.status!=='未处理'?badge(x.status,'mint'):''}${x.saved?badge('已收藏','amber'):''}</div>
      <div class="card-tools">${btn(icon('book')+(x.saved?'已收藏':'收藏'),'save-item',x.saved?'saved':'',x.id)}${btn(x.status==='已忽略'?'恢复':'忽略','ignore-item','',x.id)}${btn(x.topicId?'查看选题':'推选题','topic-item','green-btn',x.id)}</div>
      </div></article>`;
  }).join('')}</div>`;
}
export function contentTable(C,list) {
  const {btn,badge,fmt,when,esc}=C;
  return `<div class="table-wrap"><table><thead><tr><th class="check-cell"><input type="checkbox" data-select-page aria-label="选择本页全部内容" ${list.length&&list.every(x=>C.selected.has(x.id))?'checked':''}></th><th>内容 / 来源</th><th>累计点赞</th><th>基准倍数</th><th>快照变化</th><th>处理状态</th><th>操作</th></tr></thead><tbody>${list.map(x=>`<tr><td><input type="checkbox" data-select-item="${x.id}" aria-label="选择：${esc(x.title)}" ${C.selected.has(x.id)?'checked':''}></td><td class="title-cell">${btn(esc(x.title),'item','',x.id)}<div class="secondary">${esc(x.platform)} · ${esc(x.author)} · ${esc(freshness(x,C.data.serverTime).label)} · 采集 ${when(x.lastSeen)}</div></td><td>${esc(x.likesText)}</td><td>${relativeMultiple(x)==null?'—':'×'+relativeMultiple(x).toFixed(1)}</td><td>${x.delta==null?'—':(x.delta>=0?'+':'')+fmt(x.delta)+` / ${x.deltaHours.toFixed(1)}h`}</td><td>${badge(x.status)}</td><td><div class="row nowrap">${btn(x.saved?'已收藏':'收藏','save-item','quiet small',x.id)}${btn(x.status==='已忽略'?'恢复':'忽略','ignore-item','quiet small',x.id)}${btn(x.topicId?'查看选题':'推选题','topic-item','green-btn small',x.id)}</div></td></tr>`).join('')}</tbody></table></div>`;
}
function pager(C,total) {
  const pages=Math.max(1,Math.ceil(total/12));
  return `<div class="pagination"><span>共 ${total} 条 · 当前第 ${C.filters.page} / ${pages} 页</span><div class="row"><button data-action="prev" ${C.filters.page<=1?'disabled':''}>上一页</button><button data-action="next" data-id="${pages}" ${C.filters.page>=pages?'disabled':''}>下一页</button></div></div>`;
}
function selectionBar(C) {
  const {btn,selected,filters}=C;
  return `<div class="batchbar"><div class="row"><label class="inline-label"><input type="checkbox" data-select-page aria-label="选择本页" ${filters.visibleIds?.length&&filters.visibleIds.every(id=>selected.has(id))?'checked':''}>本页</label><span>${selected.size?'已选择 '+selected.size+' 条':'勾选内容可批量处理'}</span></div><div class="row">${selected.size?`${btn('批量推选题','batch-topic','green-btn small')}${btn('批量收藏','batch-save','small')}${btn(filters.bucket==='ignored'?'批量恢复':'批量忽略',filters.bucket==='ignored'?'batch-restore':'batch-ignore','small')}${btn('取消选择','clear-selection','quiet small')}`:''}</div></div>`;
}
export function renderDiscovery(C) {
  const {data,filters:f,btn,badge,icon,fmt,esc,search,viewToggle,select,empty}=C;
  const tab=f.discoveryTab||'viral';
  const intro=`<div class="discovery-heading"><div><div class="eyebrow">发现 · 最近采集 ${C.when(data.runs.find(r=>!r.metadataOnly)?.at)}</div><div class="tabs discovery-tabs">${[['viral','爆款'],['ranking','榜单'],['sources','来源']].map(([v,t])=>btn(t+(v==='viral'?`<sup>${data.items.filter(x=>x.status==='未处理').length}</sup>`:''),'discovery-tab',tab===v?'selected':'',v)).join('')}</div></div><div class="heading-actions">${tab!=='sources'?search():''}${tab==='viral'?viewToggle():''}<button data-action="export-view" class="icon-button" aria-label="导出内容 CSV" title="导出当前筛选内容">${icon('download')}</button>${btn(icon('upload')+'导入','import')}${btn(icon('refresh')+'重新读取','refresh','primary')}</div></div>`;
  if(tab==='sources'){f.exportIds=data.items.map(x=>x.id);return intro+sourcePanel(C);}
  if(tab==='ranking') return intro+rankingPanel(C);
  const bucket=f.bucket||'pending';
  const stats=[['pending','未处理','还没推选题或忽略'],['today','今天新增','按首次采集日期 · 北京时间'],['multiple','倍数 ×10 以上','同账号近期点赞基准'],['pushed','已推选题','在创作看板继续'],['ignored','已忽略','点击查看 · 可恢复']];
  const statHtml=`<div class="discovery-stats">${stats.map(([key,label,foot])=>{
    const n=filterItems(data.items,{bucket:key},data.settings,data.serverTime).length;
    return `<button class="stat ${bucket===key?'selected':''}" data-action="discovery-bucket" data-id="${key}" aria-pressed="${bucket===key}"><div class="label row spread">${label}${bucket===key?'<span class="green">✓ 正在看</span>':''}</div><strong>${n}</strong><small>${key==='multiple'&&!n?'尚无完整账号基准':foot}</small></button>`;
  }).join('')}</div>`;
  const freshView=['priority','recent7','recent24','growing'].includes(f.recency);
  const groups=weeklyTopics(filterItems(baseScope(C),{recency:f.recency,bucket:'all'},data.settings,data.serverTime),data.serverTime);
  const weekly=`<section class="weekly"><div class="weekly-heading"><div><b>${freshView?'近期内容话题共现':'本周采集话题共现'}</b><span>当前时间筛选内 · 近 7 天采集 · 至少 2 位作者 · 标题归类，非趋势认证</span></div>${btn(f.weeklyCollapsed?'展开 '+icon('down'):'收起 '+icon('down'),'toggle-weekly','quiet small')}</div>${f.weeklyCollapsed?'':groups.length?`<div class="weekly-grid">${groups.slice(0,12).map(g=>`<button class="weekly-topic ${f.topic===g.name?'selected':''}" data-action="filter-topic" data-id="${esc(g.name)}"><strong>${esc(g.name)}</strong><span><b>${g.authors}</b> 位作者 · ${g.ids.length} 条内容</span><small>已知累计点赞 ${fmt(g.likes)}${g.measured<g.ids.length?'（部分）':''}</small><div>${g.platforms.map(p=>`<i class="platform-dot ${p==='小红书'?'red':'cyan'}" title="${p}"></i>`).join('')}${badge('查看内容','mint')}</div></button>`).join('')}</div>`:`<p class="weekly-empty">当前范围还没有两位作者共同提及的话题。</p>`}</section>`;
  const list=filterItems(data.items,f,data.settings,data.serverTime);
  f.exportIds=list.map(x=>x.id);
  f.page=Math.min(f.page,Math.max(1,Math.ceil(list.length/12)));
  const page=list.slice((f.page-1)*12,f.page*12);f.visibleIds=page.map(x=>x.id);
  const platforms=['全部平台','小红书','抖音'];
  const controls=`<div class="toolbar"><div class="chips">${btn('全部内容','discovery-bucket','chip '+(bucket==='all'?'active':''),'all')}${platforms.map(p=>btn((p==='全部平台'?'':`<i class="platform-dot ${p==='小红书'?'red':'cyan'}"></i>`)+p+' '+data.items.filter(x=>p==='全部平台'||x.platform===p).length,'discovery-platform','chip '+(f.platform===p?'active':''),p)).join('')}<span class="filter-divider"></span>${['高互动','低粉爆款','异常值','来自对标'].map(t=>btn(t,'discovery-attribute','chip '+(f.attribute===t?'active':''),t)).join('')}</div><div class="row">${select('track',['全部赛道',...data.tracks,'泛热点'].map(x=>[x,x]))}${select('sort',[['published','排序：新发布优先'],['likes','排序：累计点赞'],['latest','排序：新发现'],['delta','排序：点赞增长'],['multiple','排序：基准倍数']])}</div></div>`;
  const recencies=[['priority','优先发现'],['recent24','近 24 小时发布'],['recent7','近 7 天发布'],['growing','近期快照增长'],['historical','历史参考'],['unknown','日期待核实'],['all','全部时间']];
  const timebar=`<section class="freshness-panel"><div class="row spread"><b>新热点、新爆款优先</b>${btn('查看采集计划','nav','quiet small','monitors')}</div><div class="chips">${recencies.map(([key,label])=>btn(label+' '+filterItems(data.items,{...f,q:'',topic:'',author:'',attribute:'',recency:key},data.settings,data.serverTime).length,'discovery-recency','chip '+((f.recency||'all')===key?'active':''),key)).join('')}</div><p>新发布按可核对的发布时间筛选；新爆款先看近期内容的互动与回访增长。日期不明、仅首次发现和累计高赞，都不作为正在爆火的证据。</p></section>`;
  const active=f.topic||f.author||f.attribute||f.q||f.track!=='全部赛道'||f.platform!=='全部平台';
  return intro+timebar+statHtml+weekly+controls+(active?`<div class="active-filters">${f.topic?badge('话题：'+f.topic,'mint'):''}${f.author?badge('作者：'+f.author):''}${f.attribute?badge(f.attribute):''}<span>匹配 ${list.length} 条</span>${btn('清空筛选','clear-discovery','quiet small')}</div>`:'')+selectionBar(C)+(page.length?(f.view==='cards'?contentCards(C,page):contentTable(C,page)):empty(freshView?'当前没有符合时间与证据要求的内容':'当前条件下没有内容',freshView?'旧内容的发布时间尚未核实，不会混进新热点。每日采集将优先核对近期作品；可查看日期待核实或历史参考。':f.attribute==='低粉爆款'||f.attribute==='异常值'||bucket==='multiple'?'需要已采集的粉丝数和至少 5 条作品的点赞基准；数据不足时不推算。':'可切换“全部内容”、平台或处理状态。',btn('查看全部内容','clear-discovery','small')))+pager(C,list.length)+`<div class="evidence-foot">${icon('info')} 点赞为页面累计值；本周按采集时间聚合，可能包含历史作品。基准倍数 = 该内容点赞 ÷ 已核验的账号近期作品点赞中位数。</div>`;
}
function baseScope(C) {return C.data.items.filter(x=>(C.filters.platform==='全部平台'||x.platform===C.filters.platform)&&(C.filters.track==='全部赛道'||x.track===C.filters.track));}
function sourcePanel(C) {
  const {data,btn,badge,esc,when}=C;
  return `<div class="section-heading"><h2>采集来源</h2>${btn('管理监控','nav','small','monitors')}</div><div class="source-grid">${['小红书','抖音'].map(p=>{
    const rows=data.items.filter(x=>x.platform===p);const ms=data.monitors.filter(x=>x.platform===p&&!x.archived&&x.enabled);
    return `<section class="panel"><div class="panel-head"><h2>${p}</h2>${badge('浏览器可见页面','mint')}</div><div class="panel-body"><div class="source-metric"><strong>${rows.length}</strong><span>已保存内容</span><strong>${data.comments.filter(c=>rows.some(x=>x.id===c.itemId)).length}</strong><span>评论样本</span></div><p class="muted">${ms.length} 项监控启用 · 最近 ${when(rows[0]?.lastSeen)}</p><div class="row">${btn('查看平台内容','source-platform','small',p)}${btn('添加监控','new-monitor','green-btn small',p)}</div></div></section>`;
  }).join('')}</div><div class="section-heading"><h2>当前监控配置</h2>${btn('添加来源','new-monitor','primary')}</div><div class="table-wrap"><table><thead><tr><th>名称</th><th>平台 / 类型</th><th>关键词或链接</th><th>状态</th><th>管理</th></tr></thead><tbody>${data.monitors.filter(m=>!m.archived).map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.platform)} · ${esc(m.kind)}</td><td class="wrap-cell">${esc(m.keyword)}</td><td>${badge(m.enabled?'下轮将采集':'已暂停',m.enabled?'mint':'')}</td><td>${btn('编辑','edit-monitor','small',m.id)}</td></tr>`).join('')}</tbody></table></div><div class="section-heading"><h2>最近采集反馈</h2>${btn('全部记录','nav','quiet small','runs')}</div>${data.runs.slice(0,3).map(r=>`<div class="source-run"><div class="row spread"><b>${esc(r.source)}</b>${badge(r.status,r.issues.length?'amber':'mint')}</div><small>${when(r.at)} · 新增 ${r.added} · 更新 ${r.updated}</small>${r.issues.map(t=>`<p class="issue">${esc(t)}</p>`).join('')}</div>`).join('')}`;
}
function rankingPanel(C) {
  const {data,filters:f,btn,badge,fmt,esc,select,empty}=C;
  const rank=f.rank||'recent';
  let list=filterItems(data.items,{...f,bucket:'all',attribute:'',topic:'',author:'',recency:rank==='recent'?'recent7':rank==='growth'?'growing':'all',sort:rank==='recent'?'published':rank==='growth'?'delta':rank==='new'?'latest':'likes'},data.settings,data.serverTime).filter(x=>x.status!=='已忽略');
  if(rank==='growth')list=list.filter(x=>x.delta!==null);else if(rank==='likes')list=list.filter(x=>x.likes!==null);else if(rank==='general')list=list.filter(x=>x.track==='泛热点');
  f.exportIds=list.map(x=>x.id);f.visibleIds=[];
  return `<div class="toolbar"><div class="chips">${[['recent','近期新内容'],['growth','近期增长观察'],['likes','历史累计高互动'],['new','首次采集'],['general','泛流量话题']].map(([v,t])=>btn(t,'ranking','chip '+(rank===v?'active':''),v)).join('')}</div><div class="row">${select('track',['全部赛道',...data.tracks,'泛热点'].map(x=>[x,x]))}${select('platform',['全部平台','小红书','抖音'].map(x=>[x,x]))}</div></div><p class="rank-explain">${rank==='growth'?'近 48 小时回访、间隔 1–72 小时的正向点赞变化；不把长期累计差值称为正在爆发。':rank==='recent'?'仅展示发布时间有依据的近 7 天内容，按新发布优先。':'以下为已保存样本内排序；首次采集不等于新发布，累计高互动不代表当前趋势。'}</p>${list.length?`<div class="ranking-list">${list.slice(0,50).map((x,i)=>`<div class="ranking-row"><span class="rank-number ${i<3?'top':''}">${String(i+1).padStart(2,'0')}</span><div class="ranking-info">${btn(esc(x.title),'item','rank-title',x.id)}<div class="meta">${badge(x.platform)} ${esc(x.author)} · ${esc(x.track)} · 页面日期 ${esc(x.publishedText)}</div></div><div class="rank-metric"><b>${rank==='growth'?(x.delta>=0?'+':'')+fmt(x.delta):esc(x.likesText)}</b><small>${rank==='growth'?x.deltaHours.toFixed(1)+' 小时变化':'页面累计点赞'}</small></div>${btn('推选题','topic-item','green-btn small',x.id)}</div>`).join('')}</div>`:empty('还没有足够的可比数据',rank==='growth'?'每日采集回访同一内容后，这里会出现真实变化。':'调整平台或赛道后再看。')}`;
}

export function renderLibrary(C) {
  const {data,filters:f,heading,search,viewToggle,btn,select,empty}=C;
  const list=filterItems(data.items,{...f,saved:true,bucket:'all',recency:'all'},data.settings,data.serverTime).filter(x=>!f.category||(x.category||'未分类')===f.category);
  f.exportIds=list.map(x=>x.id);f.page=Math.min(f.page,Math.max(1,Math.ceil(list.length/12)));const page=list.slice((f.page-1)*12,f.page*12);f.visibleIds=page.map(x=>x.id);
  return heading('参考库','值得反复看的内容，留下你的拆解与判断。',search()+viewToggle()+btn('导出筛选结果','export-view'))+`<div class="toolbar"><div class="chips">${['','标题灵感','开头钩子','内容结构','画面参考','未分类'].map(t=>btn(t||'全部参考','library-category','chip '+((f.category||'')===t?'active':''),t||'all')).join('')}</div>${select('track',['全部赛道',...data.tracks,'泛热点'].map(x=>[x,x]))}</div>`+selectionBar(C)+(page.length?(f.view==='cards'?contentCards(C,page):contentTable(C,page)):empty('把值得借鉴的内容收进来','在发现页点击“收藏”；内容详情中可以添加分类和拆解笔记。',btn('去发现内容','nav','primary','discover')))+pager(C,list.length);
}

export function renderAccounts(C) {
  const {data,filters:f,btn,badge,esc,fmt,heading,search,empty}=C;
  const tracked=data.monitors.filter(m=>m.kind==='账号'&&!m.archived);
  const map=new Map();for(const x of data.items.filter(x=>x.author&&x.track!=='泛热点')){const key=x.platform+':'+x.author;if(!map.has(key))map.set(key,{key,author:x.author,platform:x.platform,items:[],likes:0});const g=map.get(key);g.items.push(x);g.likes+=x.likes||0;}
  const rows=[...map.values()].filter(g=>!f.q||g.author.toLowerCase().includes(f.q.toLowerCase())).sort((a,b)=>b.likes-a.likes);
  return heading('账号','管理对标账号，也能从已采集作者里发现新来源。',search()+btn('添加对标账号','new-account','primary'))+`<div class="section-heading"><h2>正在跟踪的账号 <span class="sub">${tracked.length} 个</span></h2></div>${tracked.length?`<div class="monitor-list">${tracked.map(m=>`<section class="monitor"><div class="row spread"><h3>${esc(m.name)}</h3>${badge(m.platform)}</div><p class="keywords">${esc(m.keyword)}</p><div class="row spread">${badge(m.enabled?'监控开启':'已暂停',m.enabled?'mint':'')}${btn('编辑账号','edit-monitor','small',m.id)}</div></section>`).join('')}</div>`:empty('还没有对标账号','添加账号主页后，每日任务会按配置跟进新内容。',btn('添加账号','new-account','small'))}<div class="section-heading"><h2>已采集作者 <span class="sub">同名作者按平台归组</span></h2></div><div class="table-wrap"><table><thead><tr><th>作者 / 平台</th><th>内容样本</th><th>已知累计点赞</th><th>操作</th></tr></thead><tbody>${rows.map(g=>`<tr><td>${esc(g.author)} ${badge(g.platform)}</td><td>${g.items.length}</td><td>${fmt(g.likes)}</td><td><div class="row">${btn('查看内容','account-content','small',g.items[0].id)}${btn('设为对标','track-author','green-btn small',g.items[0].id)}</div></td></tr>`).join('')}</tbody></table></div>`;
}

export function renderOperations(C) {
  const {data,btn,badge,heading,esc,when,fmt}=C;
  const active=data.topics.filter(x=>!x.archived),published=active.filter(x=>x.stage==='已发布');
  return heading('运营复盘','看清选题推进情况，安排接下来要做的内容。',btn('新建选题','new-topic','primary'))+`<div class="stats">${[['选题总数',active.length,'全部选题'],['准备创作',active.filter(x=>['待研究','待创作'].includes(x.stage)).length,'待研究与待创作'],['创作中',active.filter(x=>x.stage==='创作中').length,'正在推进'],['已发布',published.length,'已记录发布状态']].map(([label,n,foot])=>`<button class="stat" data-action="operation-stage" data-id="${label}"><div class="label">${label}</div><strong>${n}</strong><small>${foot} · 点击查看</small></button>`).join('')}</div><div class="two-col"><section class="panel"><div class="panel-head"><h2>内容排期</h2>${btn('创作看板','nav','quiet small','topics')}</div><div class="panel-body">${active.filter(t=>t.planDate).sort((a,b)=>a.planDate.localeCompare(b.planDate)).map(t=>`<div class="plan-row"><span>${esc(t.planDate)}</span>${btn(esc(t.title),'edit-topic','quiet',t.id)}${badge(t.stage)}</div>`).join('')||'<p class="muted">编辑选题时设置计划日期，排期会显示在这里。</p>'}</div></section><section class="panel"><div class="panel-head"><h2>采集覆盖</h2>${btn('采集记录','nav','quiet small','runs')}</div><div class="panel-body">${data.tracks.map(t=>{const rows=data.items.filter(x=>x.track===t);return `<div class="coverage-row"><b>${esc(t)}</b><span>${rows.length} 条内容 · ${data.comments.filter(c=>rows.some(x=>x.id===c.itemId)).length} 条评论</span></div>`;}).join('')}<p class="muted">最近更新：${when(data.runs[0]?.at)}</p></div></section></div><div class="section-heading"><h2>已发布内容</h2></div><div class="table-wrap"><table><thead><tr><th>选题</th><th>赛道</th><th>计划日期</th><th>发布链接</th><th>操作</th></tr></thead><tbody>${published.length?published.map(t=>`<tr><td>${esc(t.title)}</td><td>${badge(t.track)}</td><td>${esc(t.planDate||'—')}</td><td>${t.publishUrl?C.sourceLink(t.publishUrl,'查看作品'):'未填写'}</td><td>${btn('编辑 / 复盘','edit-topic','small',t.id)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-row">将选题设为“已发布”后，在这里回看。</td></tr>'}</tbody></table></div>`;
}

export function renderDeals(C) {
  const {data,filters:f,btn,badge,heading,esc,fmt}=C;const rows=data.deals.filter(x=>!!x.archived===!!f.archived);
  return heading('商单','把合作进度、交付时间和回款记录放在一起。',btn('新增商单','new-deal','primary'))+`<div class="toolbar"><div class="chips">${btn('进行中与已完成','archive-view','chip '+(!f.archived?'active':''),'active')}${btn('已归档','archive-view','chip '+(f.archived?'active':''),'archived')}</div><span class="muted">${rows.length} 条合作记录</span></div><div class="table-wrap"><table><thead><tr><th>合作项目</th><th>合作方</th><th>金额（元）</th><th>交付日期</th><th>进度</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(d=>`<tr><td>${esc(d.title)}</td><td>${esc(d.partner||'—')}</td><td>${d.fee==null?'—':d.fee.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${esc(d.dueDate||'未安排')}</td><td>${badge(d.stage,'mint')}</td><td><div class="row">${btn('编辑','edit-deal','small',d.id)}${btn(d.archived?'恢复':'归档','archive-deal','quiet small',d.id)}</div></td></tr>`).join(''):'<tr><td colspan="6" class="empty-row">暂无商单记录。新增后可以跟进制作、交付和回款。</td></tr>'}</tbody></table></div>`;
}
