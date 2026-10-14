export function renderTopics(C) {
  const {data,filters:f,btn,badge,esc,heading,search,filterControls,empty}=C;
  const list=C.baseFilter(data.topics).filter(t=>!!t.archived===!!f.archived&&(!f.stage||(f.stage==='准备创作'?['待研究','待创作'].includes(t.stage):t.stage===f.stage)));
  return heading('创作看板','从选题、脚本到发布，让每条内容都有下一步。',btn('新建选题','new-topic','primary'))+`<div class="toolbar"><div class="chips">${btn('全部选题','archive-view','chip '+(!f.archived?'active':''),'active')}${btn('已归档','archive-view','chip '+(f.archived?'active':''),'archived')}${f.stage?badge('状态：'+f.stage)+btn('清除状态','clear-stage','quiet small'):''}</div><div class="row">${search()}${filterControls()}</div></div><div class="kanban">${['待研究','待创作','创作中','已发布'].map(stage=>{const rows=list.filter(x=>x.stage===stage);return `<section class="column"><div class="column-head"><span>${stage}</span><span>${rows.length}</span></div>${rows.map(t=>`<article class="topic topic-editable">${btn(`<h3>${esc(t.title)}</h3>`,'edit-topic','topic-title',t.id)}<p>${badge(t.track)} ${t.sourceType==='demand'?'评论需求':t.sourceType==='item'?'内容线索':'自主选题'}</p>${t.sourceType==='demand'&&!data.demands.some(d=>d.id===t.sourceId&&d.qualified)?badge('原依据待复核','amber'):''}${t.planDate?`<p class="plan-date">计划 ${esc(t.planDate)}</p>`:''}<div class="topic-actions">${btn('编辑','edit-topic','quiet small',t.id)}${btn(t.archived?'恢复':'归档','archive-topic','quiet small',t.id)}</div></article>`).join('')||'<div class="column-empty">暂无选题</div>'}${!f.archived?btn('+ 添加选题','new-stage-topic','add-stage',stage):''}</section>`;}).join('')}</div>`;
}
export function renderMonitors(C) {
  const {data,filters:f,btn,badge,esc,heading,filterControls,icon}=C;
  const list=C.baseFilter(data.monitors).filter(m=>!!m.archived===!!f.archived);
  return heading('赛道监控','关键词、账号与单条内容，统一管理采集范围。',btn('添加监控','new-monitor','primary'))+`<div class="toolbar"><div class="chips">${btn('监控列表','archive-view','chip '+(!f.archived?'active':''),'active')}${btn('已归档','archive-view','chip '+(f.archived?'active':''),'archived')}</div>${filterControls()}</div><div class="monitor-list">${list.map(m=>`<section class="monitor"><div class="row spread"><div class="row"><span class="track-icon">${icon(m.kind==='关键词'?'search':'radar')}</span><div><h3>${esc(m.name)}</h3><div style="margin-top:6px">${badge(m.platform)} ${badge(m.kind)} ${badge(m.track)}</div></div></div><button class="switch ${m.enabled?'on':''}" role="switch" aria-label="${esc(m.name+' '+m.platform+'监控开关')}" aria-checked="${m.enabled}" data-action="toggle-monitor" data-id="${m.id}" ${m.archived?'disabled':''}></button></div><p class="keywords">${esc(m.keyword)}</p><div class="bottom"><span>${m.archived?'已归档':m.enabled?'下轮将继续采集':'已暂停'}</span><div class="row">${btn('编辑','edit-monitor','quiet small',m.id)}${btn(m.archived?'恢复':'归档','archive-monitor','quiet small',m.id)}</div></div></section>`).join('')}</div>`+collectionPlanPanel(C)+C.notice('每天 12:00 的采集任务读取这里的配置。账号监控请填主页链接；单条内容监控会积累可比快照。归档可恢复。');
}
function collectionPlanPanel(C) {
  const {data,esc,badge}=C;
  return `<section class="panel collection-plan"><div class="panel-head"><h2>下一轮采集策略</h2>${badge('计划，不代表已完成','amber')}</div><div class="panel-body"><p>优先近 24 小时，其次近 7 天。目标分配：60% 近期内容、25% 重点回访、15% 历史参考；数量不足如实记录。</p><p class="description">每个关键词监控轮换基础词与长尾词；另从当日榜单、新产品与评论中扩展新词。每位作者每轮最多 2 条新发现，减少单一账号占据结果。以下为本次读取配置生成的检索清单。</p>${data.collectionPlan.length?data.collectionPlan.map(p=>`<div class="plan-query"><b>${esc(p.platform)} · ${esc(p.track)} · ${esc(p.kind)}</b><p>${(p.queries||[p.target]).map(q=>badge(esc(q))).join(' ')}</p></div>`).join(''):'<p>采集已暂停，或没有启用的监控。</p>'}<p class="description">实际执行的关键词、排序与缺口会写入采集记录。无法访问最新排序时，不用历史热榜冒充新热点。</p></div></section>`;
}
export function showTopicForm(C,t={}) {
  const {overlay,modalHead,esc,btn,data}=C;
  const source=t.sourceType==='item'?data.items.find(x=>x.id===t.sourceId):data.demands.find(x=>x.id===t.sourceId);
  const warning=t.sourceType==='demand'&&!source?.qualified?'<p class="notice">这个已有选题的原依据尚未达到新的证据标准，请重新核对。你的标题、笔记和创作进度已保留。</p>':'';
  const evidence=source?(t.sourceType==='item'?C.sourceLink(source.url,source.title):source.examples.map(x=>C.quote(x)).join('')):'';
  overlay(`${modalHead(t.id?'编辑选题':'新建选题')}<form id="topic-form" data-id="${esc(t.id||'')}"><div class="modal-body">${warning}<input type="hidden" name="archived" value="${t.archived===true}"><input type="hidden" name="restoreSource" value="${t.restoreSource===true}"><input type="hidden" name="sourceId" value="${esc(t.sourceId||'')}"><input type="hidden" name="sourceType" value="${esc(t.sourceType||'manual')}"><div class="form-grid"><label class="full">选题标题<input name="title" required maxlength="300" value="${esc(t.title||'')}" placeholder="要解决谁的什么问题？"></label><label>所属赛道<select name="track">${[...data.tracks,'泛热点'].map(x=>`<option ${t.track===x?'selected':''}>${x}</option>`).join('')}</select></label><label>创作状态<select name="stage">${['待研究','待创作','创作中','已发布'].map(x=>`<option ${t.stage===x?'selected':''}>${x}</option>`).join('')}</select></label><label>计划日期<input name="planDate" type="date" value="${esc(t.planDate||'')}"></label><label>发布链接<input name="publishUrl" type="url" value="${esc(t.publishUrl||'')}" placeholder="发布后填写作品地址"></label><label class="full">创作思路 / 复盘<textarea name="notes" rows="5" maxlength="10000" placeholder="目标观众、核心痛点、证据和自己的切入角度…">${esc(t.notes||'')}</textarea></label><label class="full">脚本 / 正文草稿<textarea name="draft" rows="8" maxlength="50000" placeholder="开头钩子 → 问题与冲突 → 演示或证据 → 结论与行动…">${esc(t.draft||'')}</textarea></label></div>${evidence?`<details class="form-source"><summary>查看原始依据</summary>${evidence}</details>`:''}<div class="export-feedback"></div><div class="form-error"></div></div><div class="modal-footer">${t.id?btn('导出草稿','export-topic','quiet',t.id):''}${btn('取消','close')}<button type="submit" class="primary">保存选题</button></div></form>`);
}
function dealForm(C,d={}) {
  const {overlay,modalHead,esc,btn}=C;
  overlay(`${modalHead(d.id?'编辑商单':'新增商单')}<form id="deal-form" data-id="${esc(d.id||'')}"><div class="modal-body"><div class="form-grid"><label class="full">合作项目<input name="title" required maxlength="200" value="${esc(d.title||'')}"></label><label>合作方<input name="partner" value="${esc(d.partner||'')}"></label><label>金额（元）<input name="fee" type="number" min="0" step="0.01" value="${d.fee??''}"></label><label>交付日期<input name="dueDate" type="date" value="${esc(d.dueDate||'')}"></label><label>进度<select name="stage">${['待沟通','已确认','制作中','已交付','已回款'].map(s=>`<option ${s===d.stage?'selected':''}>${s}</option>`).join('')}</select></label><label class="full">需求 / 交付 / 回款备注<textarea name="notes" rows="5">${esc(d.notes||'')}</textarea></label></div><div class="form-error"></div></div><div class="modal-footer">${btn('取消','close')}<button type="submit" class="primary">保存商单</button></div></form>`);
}
function exportResult(C,result) {
  C.overlay(`${C.modalHead('文件已保存')}<div class="modal-body"><p>${result.count==null?'文件已生成。':`已导出 ${result.count} 条内容。`}可直接从本机路径打开，或下载副本。</p><label>保存位置<input readonly value="${C.esc(result.path)}" id="export-path"></label><div class="row" style="margin-top:16px">${C.btn('复制路径','copy-export-path','small')}<a href="${C.esc(result.downloadUrl)}" download="${C.esc(result.filename)}">下载副本</a></div></div><div class="modal-footer">${C.btn('完成','close','primary')}</div>`);
}
export async function extraAction(C,a,id) {
  const {data,filters:f,selected,render,navigate,toast,api,refresh,btn,esc,overlay,modalHead}=C;
  const resetPage=()=>{f.page=1;selected.clear();render();};
  if(a==='discovery-tab'){f.discoveryTab=id;f.q='';resetPage();return true;}
  if(a==='discovery-bucket'){f.bucket=id;f.recency='all';resetPage();return true;}
  if(a==='discovery-recency'){f.recency=id;f.sort=id==='growing'?'delta':'published';resetPage();return true;}
  if(a==='discovery-platform'){f.platform=id;resetPage();return true;}
  if(a==='discovery-attribute'){f.attribute=f.attribute===id?'':id;resetPage();return true;}
  if(a==='filter-topic'){f.topic=f.topic===id?'':id;resetPage();return true;}
  if(a==='toggle-weekly'){f.weeklyCollapsed=!f.weeklyCollapsed;render();return true;}
  if(a==='ranking'){f.rank=id;render();return true;}
  if(a==='clear-discovery'){Object.assign(f,{q:'',track:'全部赛道',platform:'全部平台',bucket:'all',recency:'all',attribute:'',topic:'',author:''});resetPage();return true;}
  if(a==='library-category'){f.category=id==='all'?'':id;resetPage();return true;}
  if(a==='archive-view'){f.archived=id==='archived';f.stage='';resetPage();return true;}
  if(a==='clear-stage'){f.stage='';render();return true;}
  if(a==='source-platform'){f.platform=id;f.discoveryTab='viral';f.bucket='all';f.recency='all';resetPage();return true;}
  if(a==='clear-selection'){selected.clear();render();return true;}
  if(a==='export-view'){
    exportResult(C,await api('export-file',{kind:'content',ids:f.exportIds||data.items.map(x=>x.id)}));return true;
  }
  if(a==='export-topic'){const form=document.querySelector('#topic-form'),fields=form?Object.fromEntries(new FormData(form)):data.topics.find(x=>x.id===id);const result=await api('export-file',{kind:'draft',...fields});if(form)form.querySelector('.export-feedback').innerHTML=`<p class="description">草稿已导出</p><input readonly aria-label="草稿保存路径" value="${esc(result.path)}"><a href="${esc(result.downloadUrl)}" download>下载草稿副本</a>`;toast('当前草稿已导出');return true;}
  if(a==='export-backup'){exportResult(C,await api('export-file',{kind:'backup'}));return true;}
  if(a==='copy-export-path'){const input=document.querySelector('#export-path');try{await navigator.clipboard.writeText(input.value);toast('路径已复制');}catch{input.focus();input.select();toast('已选中路径，请按 Ctrl+C 复制');}return true;}
  if(a==='save-item'||a==='ignore-item'){
    const x=data.items.find(x=>x.id===id);await api('items',{id,action:a==='save-item'?(x.saved?'unsave':'save'):(x.status==='已忽略'?'restore':'ignore')});await refresh();
    if(document.querySelector('.drawer'))C.itemDetail(id);toast(a==='save-item'?(x.saved?'已移出参考库':'已收藏到参考库'):(x.status==='已忽略'?'已恢复内容':'已忽略，可在“已忽略”恢复'));return true;
  }
  if(a.startsWith('batch-')){if(!selected.size){toast('请先勾选内容');return true;}const result=await api('items',{ids:[...selected],action:a.slice(6)});selected.clear();await refresh();toast(`已处理 ${result.count} 条内容`);return true;}
  if(a==='new-account'){C.monitorForm({kind:'账号'});return true;}
  if(a==='track-author'){const x=data.items.find(x=>x.id===id);const key=v=>{try{const u=new URL(v);return u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}};const existing=data.monitors.find(m=>!m.archived&&m.kind==='账号'&&m.platform===x.platform&&key(x.authorUrl)&&key(m.keyword)===key(x.authorUrl));C.monitorForm(existing||{name:x.author,platform:x.platform,track:x.track,kind:'账号',keyword:x.authorUrl||''});return true;}
  if(a==='watch-item'){const x=data.items.find(x=>x.id===id);C.monitorForm({name:x.title.slice(0,100),platform:x.platform,track:x.track,kind:'单条内容',keyword:x.url});return true;}
  if(a==='account-content'){const x=data.items.find(x=>x.id===id);navigate('discover');Object.assign(C.getFilters(),{author:x.author,authorPlatform:x.platform,bucket:'all',recency:'all'});C.render();return true;}
  if(a==='new-stage-topic'){C.topicForm({stage:id});return true;}
  if(a==='operation-stage'){navigate('topics');C.getFilters().stage={'创作中':'创作中','已发布':'已发布','准备创作':'准备创作'}[id]||'';C.render();return true;}
  if(a==='topic-source'){const [type,sid]=id.split(':');C.close();type==='item'?C.itemDetail(sid):C.demandDetail(sid);return true;}
  if(a==='archive-topic'){const t=data.topics.find(x=>x.id===id);await api('topics',{...t,archived:!t.archived});await refresh();toast(t.archived?'选题已恢复':'选题已归档');return true;}
  if(a==='archive-monitor'){const m=data.monitors.find(x=>x.id===id);await api('monitors',{...m,archived:!m.archived});await refresh();toast(m.archived?'监控已恢复':'监控已归档');return true;}
  if(a==='new-deal'||a==='edit-deal'){dealForm(C,data.deals.find(x=>x.id===id));return true;}
  if(a==='archive-deal'){const d=data.deals.find(x=>x.id===id);await api('deals',{...d,archived:!d.archived});await refresh();toast(d.archived?'商单已恢复':'商单已归档');return true;}
  if(a==='demand-status'){f.status=id;f.type='全部类型';resetPage();return true;}
  if(a==='comments-library'){
    overlay(`${modalHead('已采集评论原话')}<div class="drawer-content"><p class="description">共 ${data.comments.length} 条去重评论，可回到对应作品核对上下文。</p>${data.comments.map(c=>{const x=data.items.find(x=>x.id===c.itemId);return `<div class="comment-source">${C.quote({...c,url:x?.url,platform:x?.platform,title:x?.title})}${btn(esc(x?.title||'查看内容'),'item','quiet small',c.itemId)}</div>`;}).join('')}</div>`,true);return true;
  }
  if(a==='today-stat'){
    if(id==='comments'){C.navigate('demands');return true;}
    if(id==='topics'){C.navigate('topics');return true;}
    C.navigate('discover');Object.assign(C.getFilters(),{bucket:'all',attribute:id==='high'?'高互动':''});C.render();return true;
  }
  return false;
}
export async function extraSubmit(C,form,fields) {
  if(form.id==='deal-form'){
    const old=C.data.deals.find(d=>d.id===form.dataset.id);await C.api('deals',{...old,...fields,id:form.dataset.id||undefined});
  }else if(form.id==='reference-form'){
    await C.api('items',{id:form.dataset.id,action:'note',note:fields.note,category:fields.category});
    await C.refresh();C.toast('参考笔记已保存');return true;
  }else return false;
  C.close();await C.refresh();C.toast('已保存');return true;
}
