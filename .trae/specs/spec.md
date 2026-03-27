# UnShellX - 产品需求文档

## Overview
- **Summary**: UnShellX 是一个逆向工程项目，用于对天刀助手 (TiandaoHelper) APK 进行脱壳和反编译，提取解密后的 DEX 文件并转换为 Java 源码。
- **Purpose**: 解决腾讯乐固 4.6.2.2 + 梆梆加固的双重保护机制，使逆向工程师能够分析应用的内部结构和功能。
- **Target Users**: 逆向工程师、安全研究人员、应用开发者。

## Goals
- 成功从加固的 APK 中提取解密后的 DEX 文件
- 将提取的 DEX 文件反编译为可读的 Java 源码
- 提供自动化的工作流程，简化脱壳和反编译过程
- 优化脱壳脚本的性能和可靠性
- 提供详细的文档和使用指南

## Non-Goals (Out of Scope)
- 破解应用的商业逻辑或版权保护
- 开发针对其他加固方案的脱壳脚本
- 实现图形用户界面
- 分析应用的具体业务逻辑

## Background & Context
- 目标应用使用腾讯乐固 4.6.2.2 + 梆梆加固进行保护
- 壳 DEX 文件头为 `dex.035`（不是真正的 DEX）
- 加密 DEX 存储在 `assets/0OO00l111l1l` (19MB) 中
- 壳 SO 为 `lib/arm64-v8a/libshell-super.com.tencent.gamehelper.wuxia.so`

## Functional Requirements
- **FR-1**: 开发 Frida 脱壳脚本，Hook 关键函数提取 DEX 文件
- **FR-2**: 实现内存扫描功能，捕获内存中的解密 DEX
- **FR-3**: 创建自动化脚本，实现脱壳、提取和反编译的完整流程
- **FR-4**: 优化脱壳脚本的性能和可靠性
- **FR-5**: 生成详细的分析报告，包括代码结构和关键功能
- **FR-6**: 利用 Claude Code 协助代码分析和生成，提高开发效率
- **FR-7**: 建立与 Claude Code 的异步协作流程，实现并行工作

## Non-Functional Requirements
- **NFR-1**: 脱壳脚本应具有良好的错误处理和日志记录
- **NFR-2**: 反编译脚本应支持并行处理，提高效率
- **NFR-3**: 脚本应具有良好的可维护性和可扩展性
- **NFR-4**: 文档应详细、清晰，便于其他用户理解和使用
- **NFR-5**: 与 Claude Code 的协作流程应高效、可靠
- **NFR-6**: 多终端配置应合理，充分利用系统资源

## Constraints
- **Technical**: 需要 Android 设备或模拟器，需要 ROOT 权限
- **Business**: 仅用于合法的安全研究和逆向工程学习
- **Dependencies**: 依赖 Frida、ADB、jadx、dex2jar 等工具

## Assumptions
- 用户已安装并配置好所需的工具和环境
- 用户具有基本的逆向工程和命令行操作知识
- 目标应用的加固方式与分析时一致

## Acceptance Criteria

### AC-1: Frida 脱壳脚本功能
- **Given**: 已启动 Frida 脱壳脚本并运行目标应用
- **When**: 应用运行并触发类加载
- **Then**: 脚本成功提取解密后的 DEX 文件并保存到指定目录
- **Verification**: `programmatic`
- **Notes**: 验证提取的 DEX 文件是否可反编译

### AC-2: 内存扫描功能
- **Given**: 已启动带有内存扫描功能的脱壳脚本
- **When**: 应用运行时内存中存在解密的 DEX
- **Then**: 脚本成功扫描并提取内存中的 DEX 文件
- **Verification**: `programmatic`
- **Notes**: 验证提取的 DEX 文件完整性

### AC-3: 自动化脚本功能
- **Given**: 运行完整的自动化脚本
- **When**: 脚本执行脱壳、提取和反编译流程
- **Then**: 脚本成功完成所有步骤并生成可阅读的 Java 源码
- **Verification**: `programmatic`
- **Notes**: 验证生成的源码是否完整可读

### AC-4: 性能优化
- **Given**: 运行优化后的脱壳脚本
- **When**: 应用启动并运行
- **Then**: 脚本在 60 秒内完成脱壳过程
- **Verification**: `programmatic`
- **Notes**: 验证脚本执行时间和资源占用

### AC-5: 文档完整性
- **Given**: 阅读项目文档
- **When**: 按照文档说明执行操作
- **Then**: 能够成功完成脱壳和反编译过程
- **Verification**: `human-judgment`
- **Notes**: 验证文档的清晰度和完整性

### AC-6: Claude Code 协作功能
- **Given**: 启动 Claude Code 并分配任务
- **When**: Claude Code 处理任务的同时执行其他操作
- **Then**: Claude Code 能够成功完成任务，并且与手动操作并行执行
- **Verification**: `programmatic`
- **Notes**: 验证异步协作流程的效率和可靠性

### AC-7: 多终端配置
- **Given**: 启动多个 Claude Code 终端
- **When**: 每个终端处理不同的任务
- **Then**: 所有终端能够同时工作，互不干扰
- **Verification**: `programmatic`
- **Notes**: 验证多终端配置的合理性和资源利用情况

## Open Questions
- [ ] 目标应用的具体版本号
- [ ] 目标设备的 Android 版本
- [ ] 是否需要支持其他加固版本
- [ ] 是否需要添加更多的分析工具