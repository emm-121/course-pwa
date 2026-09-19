# 今日课表 PWA · v0.5

手机优先的静态课表 PWA。无账号、无数据库、无后端，直接部署到 GitHub Pages。

## 普通使用

用户只需要打开首页：

- **今天**：当前/下一节课、当天课程、明日预览
- **本周**：手机纵向周课表
- **更多**：数据更新时间、手动检查更新、添加到主屏幕提示

普通页面不会显示导入、调课、测试或开发入口。

## 维护入口

维护工具仍然是纯静态页面，但不会出现在普通 UI 中：

- `admin.html`：维护入口总览
- `semester.html`：每学期设置第一周、总周数和节次时间，生成 `semester.json`
- `import.html`：导入正方 / WakeUp / Sleepy JSON，检查冲突并生成 `schedule.json`
- `manage.html`：停课、补课、跨周调课、换教室等，生成 `exceptions.json`
- `shortcut-setup.html`：正方 Safari 快捷指令准备与测试
- `tools/zhengfang-fixture.html`：模拟正方课表测试页

> 注意：这些页面只是“隐藏入口”，不是权限保护。GitHub Pages 仍是公开静态站点，因此项目不保存账号密码、Cookie、GitHub Token 或其他写入凭据。

## 数据文件

- `data/semester.json`：学期、第一周、作息时间
- `data/schedule.json`：基础课表
- `data/exceptions.json`：学校实际停课/补课/调课
- `data/holidays.json`：法定节假日提示；不会自动决定停课

## 正方导入

推荐最终流程：

1. 维护者先在自己的 iPhone 上完成并验证“发送课表”快捷指令。
2. 快捷指令结构：`Safari 网页 → 在网页上运行 JavaScript → 共享`。
3. 验证成功后，通过 iCloud 链接分享完整快捷指令。
4. 使用者只需添加快捷指令，然后在正方“学期课表”页面运行一次并把导出结果分享给维护者。
5. 维护者用 `import.html` 检查并生成 `schedule.json`，上传 GitHub。
6. 此后使用者日常只打开主屏幕上的“今日课表”。

正方脚本会尽量额外提取：

- 学年 / 学期提示
- 最大周次
- 当前页面若能找到周次日期范围，则推导第一周日期
- 表格中若能识别节次起止时间，则输出作息提示

这些辅助字段用于维护，不会影响课程列表导入。

## 调休模型

支持：

- `dayOff`：全天停课
- `useDate`：把某个具体日期的真实课表搬到目标日期，适合跨周调休
- `useWeekday`：按目标周内某星期的课表上课
- `cancel`：取消单次课程
- `modify`：单次换教室 / 换教师 / 换节次
- `add`：临时补课

`useDate` 会保留**来源日期**的实际周次规则，因此不会把单双周套到错误的目标周。

## 部署

GitHub Pages：`main` 分支、`/(root)` 发布即可。

更新同名文件后，Pages 会自动重新部署。Service Worker 采用联网优先策略：联网时获取最新数据，断网时使用缓存。

## 本地测试

```bash
npm test
```

当前自动测试覆盖周次、单双周/不连续周、跨周调休、课程修改、作息 profile、冲突检测和 WakeUp 导入等核心逻辑。
