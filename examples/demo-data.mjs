// 全部为虚构教学数据，只由 npm run demo 写入内存；不能当作真实采集或需求证据。
export function seedDemo(store, now=new Date()) {
  const time=hours=>new Date(now.getTime()-hours*3600000).toISOString();
  const titles=[
    ['AI 工具','AI表格助手：从原始账单到周报，实测三个步骤',1860],
    ['AI 自媒体','AI口播去模板感：先改开头，再改表达',3120],
    ['AI 硬件','AI眼镜通勤实测：续航、导航与佩戴感',920],
    ['AI 工具','同一份表格交给两种AI工作流，结果差在哪',2480],
    ['AI 自媒体','短视频人物一致性，提示词之外还要做什么',680],
    ['AI 硬件','本地语音桌面助手，从零跑通第一句话',1450],
    ['AI 工具','AI录音转写工具：多人会议如何区分说话人',750],
    ['AI 自媒体','AI剪辑工作流：三分钟视频究竟花多少积分',2080],
    ['AI 硬件','AI录音笔离线模式能做到哪些功能',430],
    ['AI 工具','AI编程工具生成之后，怎样验收交付',630],
    ['AI 自媒体','一条教程拆成图文、口播和清单的创作流程',970],
    ['AI 硬件','开源AI陪伴设备：声音延迟和隐私的取舍',820],
    ['AI 工具','旧高赞教程仍有用：AI办公常用技巧汇总',18000],
    ['AI 自媒体','这条高赞视频没有可核对日期，先保留参考',12000],
    ['泛热点','演示热点：开学季的数字学习工具讨论',null],
    ['泛热点','演示热点：居家办公的效率与边界',null]
  ];
  const url=i=>`https://example.com/longjing-demo/content-${i+1}`;
  const question='【演示原话】这个表格助手处理客户账单时，怎么先隐藏姓名和手机号？';
  function comment(i,author,text,likes,subject,problem) {
    return {author:'演示用户'+author,text,likes,publishedText:'演示时间',
      evidence:{pageUrl:url(i),capturedAt:time(1),locator:'虚构评论，用于展示证据字段和门槛；并非平台页面摘录',excerpt:`演示用户${author}\n${text}\n${likes}`,likesText:String(likes)},
      review:{intent:'question',subject,problem,quote:text,rationale:'演示复核：这句话明确询问该对象和场景的具体操作方法；真实采集必须另行核对原文。'}};
  }
  const items=titles.map(([track,title,likes],i)=>({
    title,url:url(i),platform:i>=14?'公开资讯':i%2?'抖音':'小红书',track,
    author:'演示创作者 '+String.fromCharCode(65+i),authorUrl:`https://example.com/longjing-demo/author-${i}`,
    likes,likesText:likes===null?'未知':String(likes),commentTotal:i>=14?null:40+i*7,
    publishedText:i===13?'日期未知':`演示发布时间 ${time(i===12?720:i<4?8+i*2:i*4+2)}`,
    ...(i===13?{}:{publishedAt:time(i===12?720:i<4?8+i*2:i*4+2),publishedTimeKind:'published',publishedPrecision:'minute',publicationEvidence:'虚构的演示日期，用于演示时间筛选'}),
    query:track+' 实测',searchSort:'演示：最新发布',
    summary:'这是一条虚构的界面演示内容，用于展示筛选、详情、收藏及创作流程。原始链接为 example.com 占位地址。',
    evidence:'合成演示数据；不是实际采集记录',comments:[]
  }));
  for(const [i,names] of [[0,['甲','乙','丙']],[3,['丁','戊','己']]])
    items[i].comments=names.map((name,j)=>comment(i,name,question,7+j,'演示表格助手 · 客户账单','上传客户账单前如何脱敏姓名和手机号'));
  items[7].comments=[comment(7,'庚','【演示原话】这个剪辑工具的免费额度，够剪一条三分钟口播吗？',160,'演示剪辑工具 · 免费额度','免费额度能否完成三分钟口播')];
  items[8].comments=[comment(8,'辛','【演示原话】离线时还能自动区分不同说话人吗？',8,'演示录音笔 · 离线转写','离线时是否支持区分说话人')];
  items[10].comments=[{author:'演示用户壬',text:'【演示】怎么调整流程？这条还没有上下文和出处摘录。',likes:null}];
  items[5].comments=[{author:'演示用户癸',text:'【演示】技术发展得真快。',likes:20,review:{intent:'observation',rationale:'演示：感慨不是明确问题，不生成需求。'}}];
  store.ingest({runKey:'demo-baseline',observedAt:time(6),source:'演示 · 首轮建立基线',items:items.slice(0,4).map(x=>({...x,likes:Math.floor(x.likes/2),likesText:String(Math.floor(x.likes/2)),comments:[]})),notes:'虚构的首轮样本；不据此认定正在爆火。'});
  store.ingest({runKey:'demo-update',observedAt:time(1),source:'演示 · 多来源采集与回访',items,
    notes:'全为虚构教学数据。展示新内容、可比快照、历史高赞、未知日期和评论证据门槛。\n多人问题：6 个演示署名 / 2 个作品；高赞问题：1 条演示问题 / 160 赞。',
    coverage:[{platform:'小红书',track:'AI 工具',query:'AI表格 脱敏 工作流',sort:'演示：最新',outcome:'展示完整来源记录，非实际检索。'},{platform:'抖音',track:'AI 自媒体',query:'AI剪辑 免费额度',sort:'演示：近7天',outcome:'展示评论采样与复核。'}],
    issues:['演示缺口：部分内容无可核对日期；不纳入近期发布。','演示缺口：单条低赞的离线转写问题未达到需求门槛。']});
  const state=store.state();
  for(const item of state.items.filter(x=>titles.slice(0,6).some(t=>t[1]===x.title))) {
    store.updateItems({id:item.id,action:'save'});
    store.updateItems({id:item.id,action:'note',category:'内容结构',note:'【演示拆解】先呈现任务结果，再展示操作过程，最后解释适用范围。'});
  }
  for(const [i,stage] of ['待研究','待创作','创作中','已发布'].entries())store.saveTopic({
    title:['客户账单先脱敏：录屏演示三种处理方法','AI口播如何去掉套话：改写前后对照','AI眼镜通勤测评的三个真实使用场景','AI工具实测：从需求到可复现结果'][i],
    track:titles[i][0],stage,planDate:time(-i*24).slice(0,10),
    notes:'【虚构演示草案】展示看板、排期与复盘，不是用户真实文稿。',
    draft:'【虚构演示脚本】\n开头：先展示结果与适用场景。\n过程：用相同输入做对照，记录失败情况。\n结尾：说明适用范围与待验证问题。',
    ...(i===3?{publishUrl:'https://example.com/longjing-demo/published'}:{})
  });
  store.saveMonitor({name:'演示对标 · 办公实测',kind:'账号',platform:'小红书',track:'AI 工具',keyword:items[0].authorUrl,enabled:true});
  store.saveDeal({title:'演示合作 · AI办公工具实测',partner:'虚构品牌 A',fee:2000,stage:'制作中',dueDate:time(-72).slice(0,10),notes:'虚构金额，仅展示合作管理。'});
  store.saveDeal({title:'演示合作 · 硬件体验记录',partner:'虚构品牌 B',fee:1500,stage:'已回款',notes:'虚构合作记录。'});
  return store;
}
