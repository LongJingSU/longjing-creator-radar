import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export function renderCSV(rows) {
  // Prefix spreadsheet formulas so titles remain text when opened in Excel.
  const cell=v=>'"'+String(v??'').replace(/^(\s*)([=+@\-])/u,"'$1$2").replaceAll('"','""')+'"';
  return '\ufeff'+[['标题','平台','作者','赛道','累计点赞','粉丝数','处理状态','收藏','采集时间','来源','参考笔记'],...rows.map(x=>[x.title,x.platform,x.author,x.track,x.likes,x.followers,x.status,x.saved?'是':'否',x.lastSeen,x.url,x.note])].map(r=>r.map(cell).join(',')).join('\r\n');
}
export async function saveExport(root,state,body) {
  let content,ext,count;
  if(body.kind==='content'){
    if(!Array.isArray(body.ids)||body.ids.length>20000)throw new Error('导出范围无效');
    const rows=state.items.filter(x=>body.ids.includes(x.id));content=renderCSV(rows);ext='csv';count=rows.length;
  }else if(body.kind==='draft'){
    content=[String(body.title||'').slice(0,300),'计划：'+String(body.planDate||'未安排').slice(0,10),String(body.notes||'').slice(0,10000),'正文草稿',String(body.draft||'').slice(0,50000)].join('\n\n');ext='txt';
  }else if(body.kind==='backup'){content=JSON.stringify(state,null,2);ext='json';}
  else throw new Error('导出类型无效');
  const filename=`chenxi-${Date.now()}-${randomUUID().slice(0,8)}.${ext}`;
  const directory=resolve(root,'data','exports');await mkdir(directory,{recursive:true});
  const path=resolve(directory,filename);await writeFile(path,content,'utf8');
  return {filename,path,count,downloadUrl:'/api/exports/'+filename};
}
