# 今日课表 PWA v0.2

这是从第一版原型重构后的可部署测试版，目标是让使用者平时只做一件事：打开主屏幕上的“今日课表”。

## 当前能力

- iPhone / Android 手机优先界面
- 自动按学校时区（Asia/Shanghai）判断“今天”
- 已确认第 1 周周一为 2026-08-31；第 4 周为 2026-09-21 至 09-27
- 自动计算教学周、周次过滤
- 当前上课 / 下一节 / 今日已结束状态
- 纵向本周课表，不需要横向拖动
- 日期切换、左右滑切换日期
- dayOff / useWeekday / cancel / modify / add 异常规则核心
- 网络优先 + 离线缓存：部署后数据更新优先取新版，断网读取缓存
- 正方教务导入器与主体解耦，位于 `importers/zhengfang.js`

## 数据文件

- `data/semester.json`：学期、周数、节次时间
- `data/schedule.json`：基础课程安排
- `data/exceptions.json`：临时停课、补课、换教室等

目前课程由用户提供的学期课表截图整理。`confidence` 不为 `verified` 的记录会在界面显示“待核对”。

## 本地运行

直接双击 `index.html` 可能会被浏览器的 file:// 安全策略阻止读取 JSON。建议在目录中运行一个静态服务器，例如：

```bash
python3 -m http.server 8000
```

然后打开 `http://localhost:8000/`。

手机快速看样子可直接打开根目录里的单文件 `course-pwa-v0.2-preview.html`（该文件由交付时生成，不具备完整 PWA 安装/离线能力）。

## GitHub Pages

把本目录上传到 GitHub 仓库，Settings → Pages → Deploy from a branch → `main` / root。用 Safari 打开 Pages 地址后，“分享 → 添加到主屏幕”。

## 测试

```bash
npm test
```

当前项目无运行时第三方依赖。
