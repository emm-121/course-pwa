# 课表导入（v0.4）

目标：每学期不再逐张截图。

## 首选：iPhone Safari + 正方快捷指令

1. Safari 登录教务系统，打开“学生课表查询”。
2. 选择“学期课表”并查询。
3. 分享 → 运行「导出课表」快捷指令。
4. 把输出 JSON 发给维护者。

快捷指令配置一次：接收 Safari 网页 → “在网页上运行 JavaScript”（粘贴 `tools/zhengfang-shortcut.js`）→ 拷贝结果到剪贴板。

如果学校页面结构不同，脚本返回 `ok:false` 诊断 JSON；发回诊断即可，不需要再截整张课表。

## 备用：Android Sleepy / WakeUp JSON

如果 Safari DOM 导入失败，而 Android 可用：用支持的课表工具从教务系统导入，再导出 WakeUp 兼容 JSON。`import.html` 会自动识别并转换为本站 `schedule.json`。

## 维护者收到 JSON 后

打开已部署站点 `/import.html` → 粘贴/选择 JSON → 检查课程数与冲突 → 下载 `schedule.json` → 替换 GitHub 的 `data/schedule.json`。

## 学校放假 / 调课

打开 `/manage.html`。推荐规则：

- 全天停课：`dayOff`
- 整天课程跨周移动：`useDate`（最稳）
- 同一周临时按其他星期：`useWeekday`
- 单节取消：`cancel`
- 换教室/教师/节次：`modify`
- 临时补课：`add`

下载生成的 `exceptions.json`，替换 GitHub `data/exceptions.json`。

## 在朋友参与前先自测快捷指令

部署 v0.4 后打开 `/shortcut-setup.html`：复制脚本并按页面说明建立快捷指令，然后用 Safari 打开 `/tools/zhengfang-fixture.html` 运行。正常输出应识别 2 个课程安排。这样可以先验证 iPhone 的快捷指令链路，朋友只负责最后一次真实教务页面测试。
