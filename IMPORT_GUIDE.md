# 课表导入与交付流程

## A. 一次性准备“发送课表”快捷指令

在维护者自己的 iPhone 上完成：

1. 新建快捷指令，设置为从共享表单接收 **Safari 网页**。
2. 添加 **在网页上运行 JavaScript**。
3. 将 `tools/zhengfang-shortcut.js` 的全部内容粘进去。
4. JavaScript 动作之后添加 **共享**。
5. 命名为“发送课表”。
6. 用 `tools/zhengfang-fixture.html` 测试，确认共享结果中包含“高等数学（一）”和“大学英语”。
7. 在快捷指令的分享菜单中生成 iCloud 分享链接。

这样接收者不需要自己配置 JavaScript，只需点链接添加快捷指令。

## B. 新学期真实导出

使用者只做：

1. Safari 登录教务系统。
2. 打开“学生课表查询”。
3. 选择“学期课表”并查询。
4. Safari 分享 → **发送课表**。
5. 在系统分享面板把导出的 JSON 发给维护者。

脚本不会导出账号密码、Cookie 或完整带查询参数的 URL。

## C. 维护者导入

1. 打开 `import.html`。
2. 粘贴收到的 JSON，或选择 JSON 文件。
3. 点“检查课表”。
4. 确认课程数量和“无时间冲突”。
5. 下载 `schedule.json`。
6. 替换 GitHub 的 `data/schedule.json`。
7. 等 GitHub Pages 部署完成。

## D. 如果正方页面不兼容

脚本会返回 `ok:false` 和 `diagnostics`。保留这段 JSON 即可继续适配；不需要重新逐张截图整张学期课表。

## E. 备用导入

如果正方 Safari 导出暂时不可用，可在 Android 上使用支持教务导入的软件导出 WakeUp / Sleepy 兼容 JSON，然后放进 `import.html`。
