# TODO 待办事项列表

> 最后更新: 2026-03-27

## 高优先级

- [ ] 完成 DEX 反编译后的代码分析
- [ ] 分析 libflutter.so 入口点和通信机制
- [ ] 编写 Flutter 引擎 Hook 脚本

## 中优先级

- [ ] 研究 libckguard.so 梆梆加固核心
- [ ] 提取并分析 assets/0OO00l111l1l 加密内容
- [ ] 完善 Frida 脱壳脚本稳定性

## 低优先级

- [ ] 自动化反编译流程脚本
- [ ] 添加 APK 重打包功能
- [ ] 编写自动化测试用例

## 已完成

- [x] 环境搭建 (jadx, apktool, frida-server)
- [x] Frida 脱壳脚本修复
- [x] 手动提取已解密的 DEX 文件
- [x] DEX 文件 header 修复
- [x] DEX 反编译 (多版本输出目录)
- [x] 创建 Agent Team 操作指南 (AGENT_TEAM_GUIDE.md)
- [x] 创建研究进展文档 (RESEARCH_PROGRESS.md)
- [x] 创建开发记录文档 (TiDaoHelper开发记录.md)
- [x] 创建 TODO 待办列表 (docs/notes/TODO.md)

## 待讨论

- [?] 是否需要重打包 APK 进行动态分析？
- [?] 是否需要深入分析 ProtoBuf 通信协议？
