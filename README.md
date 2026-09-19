# Course PWA v0.4 RC

手机优先的每日大学课表 PWA。此版定位为“给朋友真实使用前的候选版”：先把我们自己能验证的基础能力补齐，再做一次真实教务导入测试。

## 已完成

- 今日 / 日期浏览 / 本周视图
- 按学校时区计算日期和周次
- 正在上课 / 下一节 / 今日结束状态
- 不连续周、单双周归一化后的 `weeks[]`
- 远程数据优先 + Service Worker 离线兜底
- 新版正方 Safari 快捷指令 DOM 导入（待真实页面最终验证）
- WakeUp / Sleepy 兼容 JSON 备用导入
- 导入后冲突检查
- 日期例外：全天停课、按星期、按**具体来源日期**复制课表、单节取消/修改/补课
- `manage.html` 图形化生成 `exceptions.json`
- 国家法定节假日提示层（只提示，不擅自替学校删课）
- 多作息时间段 `timeProfiles` 数据结构，为学校季节作息切换预留

## 为什么新增 useDate

学校节假日调课可能跨周。比如“10 月 7 日的课调到 9 月 28 日”，如果只写“9 月 28 日按周二上课”，程序会套用 9 月 28 日所在周的单双周/分段周次，可能出错。`useDate` 会直接复制来源日期的真实课表，保留来源周次。

## 文件

- `index.html` / `app.js` / `core.js`：主 PWA
- `data/semester.json`：学期、作息时间和时间配置
- `data/schedule.json`：正式课表
- `data/exceptions.json`：学校停课、补课、调课等权威日期例外
- `data/holidays.json`：国家节假日提示（非学校权威调课）
- `import.html`：课表导入检查器
- `manage.html`：调课/停课规则生成器
- `importers/zhengfang.js`：正方 DOM 解析器
- `importers/wakeup.js`：WakeUp / Sleepy JSON 兼容导入
- `tools/zhengfang-shortcut.js`：iPhone 快捷指令脚本

## 部署

GitHub Pages：`main` → `/(root)`。

## 尚需朋友参与的唯一关键验证

在真实教务页面运行一次 Safari 快捷指令。成功则直接得到整学期 JSON；失败则只返回诊断 JSON，据此修适配器，不再逐张截图。
