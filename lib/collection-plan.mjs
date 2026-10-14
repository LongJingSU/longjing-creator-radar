const tails={
  'AI 工具':['AI工具 免费额度','AI工具 办公实测','Codex 安装教程','AI Agent 新功能','AI工具 PPT 表格','AI工具 本地部署','AI工具 中文效果','AI工具 订阅成本'],
  'AI 自媒体':['AI视频 最新工具','AI剪辑 实测','AI口播 工作流','AI自媒体 起号复盘','AI写作 去模板感','AI视频 人物一致性','AI自媒体 涨粉复盘','AI剪辑 积分成本'],
  'AI 硬件':['AI眼镜 新品 实测','AI录音笔 隐私 续航','AI陪伴 实测','AI硬件 新品发布','AI眼镜 翻译 延迟','AI硬件 桌面助手','AI玩具 使用体验','AI硬件 开源 DIY']
};
export function collectionPlan(monitors, enabled=true, now=new Date().toISOString()) {
  if(!enabled)return [];
  const day=Math.floor((Date.parse(now)+8*3600e3)/864e5);
  return monitors.filter(m=>m.enabled&&!m.archived).map(m=>{
    if(m.kind!=='关键词')return {monitorId:m.id,platform:m.platform,track:m.track,kind:m.kind,target:m.keyword,priority:'先查新发布，再回访已跟踪作品'};
    const base=m.keyword.split(/[、,，\n]/).map(s=>s.trim()).filter(Boolean), pool=tails[m.track]||[];
    const queries=[base[day%base.length],base[(day+1)%base.length],pool[day%pool.length],pool[(day+3)%pool.length]].filter(Boolean);
    return {monitorId:m.id,platform:m.platform,track:m.track,kind:m.kind,queries:[...new Set(queries)],priority:'新热点优先：近24小时→近7天→增长回访→历史高互动',targetMix:'60%近期发布 / 25%回访增长 / 15%历史参考，采不到如实记缺口',maxItemsPerAuthor:2};
  });
}
