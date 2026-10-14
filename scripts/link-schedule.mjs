import {openStore} from '../lib/store.mjs';
const args=process.argv.slice(2);
const clear=args.length===1&&args[0]==='--clear';
const id=args.length===2&&args[0]==='--id'?args[1]:'';
if(!clear&&(!id||id.length>200)){
  console.error('仅登记已有外部任务，不创建或取消调度：\nnode scripts/link-schedule.mjs --id <真实任务ID>\nnode scripts/link-schedule.mjs --clear');
  process.exit(1);
}
const s=openStore();
try {s.setSettings({automationId:clear?'':id,automationStatus:clear?'未注册':'已登记外部任务'});console.log(clear?'已清除本地登记；请另行确认外部调度器已取消任务。':'已登记外部任务 ID；请在调度器及首轮采集记录中验证实际执行。');}
finally{s.close();}
