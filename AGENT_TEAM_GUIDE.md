# Claude Code Agent Team 实操指南

## 目录

1. [概述](#概述)
2. [Agent Team 基础操作](#agent-team-基础操作)
3. [Agent 类型选择](#agent-类型选择)
4. [Agent 命名规范](#agent-命名规范)
5. [Agent 间通信协作](#agent-间通信协作)（重要！默认行为）
6. [并行处理策略](#并行处理策略)
7. [Frida 脱壳实战经验](#frida-脱壳实战经验)
8. [DEX 文件提取实战经验](#dex-文件提取实战经验)
9. [Jadx 反编译实战经验](#jadx-反编译实战经验)
10. [项目特定发现](#项目特定发现)
11. [坑和注意事项](#坑和注意事项)
12. [实际案例](#实际案例)
13. [快速参考](#快速参考)

---

## 概述

Agent Team 是 Claude Code 的并行任务处理功能，适用于复杂任务分解和并行执行。典型应用场景：

- APK 脱壳：多个 DEX 文件并行反编译
- 代码分析：多个模块同时分析
- 文档生成：多个文档同时编写

---

## Agent Team 基础操作

### 工具全家桶

| 工具 | 用途 |
|------|------|
| `TeamCreate` | 创建团队 |
| `TaskCreate` | 创建任务 |
| `TaskList` | 查看任务列表 |
| `TaskGet` | 获取任务详情 |
| `TaskUpdate` | 更新任务状态 |
| `Agent` | 启动 agent |
| `SendMessage` | 发送消息 |
| `SendMessage type=shutdown_request` | 请求关闭 agent |
| `TeamDelete` | 删除团队 |

### 团队创建流程

```bash
# 1. 创建团队
TeamCreate
# 返回: team_id (如 "team-abc-123")

# 2. 创建任务
TaskCreate subject="反编译 DEX1" description="jadx 反编译 classes1.dex"
TaskCreate subject="反编译 DEX2" description="jadx 反编译 classes2.dex"
# ...

# 3. 启动 agent 并行处理
Agent taskId="1" agent_type="general-purpose" name="decomp-0"
Agent taskId="2" agent_type="general-purpose" name="decomp-1"
# ...

# 4. 发送消息协调
SendMessage type="message" recipient="decomp-0" content="开始处理..."
SendMessage type="message" recipient="decomp-1" content="开始处理..."

# 5. 请求关闭 agent
SendMessage type="shutdown_request" recipient="decomp-0" content="任务完成，请关闭"
SendMessage type="shutdown_request" recipient="decomp-1" content="任务完成，请关闭"

# 6. (可选) 删除团队
TeamDelete teamId="team-abc-123"
```

### 任务状态流转

```
pending → in_progress → completed
                    ↘ failed → in_progress (重试)
```

```bash
# 标记任务进行中
TaskUpdate taskId="1" status="in_progress" owner="decomp-0"

# 标记任务完成
TaskUpdate taskId="1" status="completed"
```

---

## Agent 类型选择

### general-purpose

通用 agent，可执行任意操作。

```bash
Agent taskId="1" agent_type="general-purpose" name="worker-0"
```

**适用场景**：
- 文件编辑、代码生成
- 执行命令
- 复杂多步骤任务

### Explore

研究探索 agent，适合深度搜索和分析。

```bash
Agent taskId="1" agent_type="Explore" name="researcher"
```

**适用场景**：
- 代码库深度探索
- 查找特定模式
- 架构分析

### Plan-Aware (plan_mode_required)

需要审批的计划模式 agent。

```bash
# 创建后，agent 会发送 plan_approval_request
# 使用 SendMessage type=plan_approval_response 批准
```

---

## Agent 命名规范

### 建议格式

| 任务类型 | 命名示例 | 说明 |
|----------|----------|------|
| 反编译 | `decomp-0`, `decomp-1` | DEX 反编译 worker |
| Frida | `frida-fixer`, `frida-tester` | Frida 脚本相关 |
| 文档 | `doc-writer`, `doc-reviewer` | 文档编写 |
| 研究 | `explorer-lib`, `explorer-core` | 代码探索 |
| 提取 | `extractor-0`, `extractor-1` | DEX 提取 worker |

### 命名原则

- 使用小写字母、数字、连字符
- 名称体现功能角色
- 避免与内置名称冲突

---

## Agent 间通信协作

### 默认行为：Agent 之间直接通信

**重要**：Agent 之间可以直接通信协调，无需都通过 team-lead 中转！

```bash
# Agent A 告知 Agent B 协调
SendMessage type="message" recipient="agent-b" content="我发现了X，请帮我验证Y"

# Agent B 发现关键信息后直接通知 Agent C
SendMessage type="message" recipient="agent-c" content="关键路径是 /data/xxx，请直接提取"
```

**好处**：
- 减少 team-lead 的协调负担
- 信息传递更直接快速
- team-lead 可以专注于监督而非中转

**启动新 agent 时的标准指引**（加入 prompt）：
```
团队成员：worker-a, worker-b
请与团队成员直接通信协调，发现问题或结果及时告知。
```

### 模式一：按文件分配

每个 agent 处理一个文件，适合文件数量少但处理复杂的场景。

```bash
# 启动 5 个 agent 并行反编译 5 个 DEX
Agent taskId="1" agent_type="general-purpose" name="decomp-0"
Agent taskId="2" agent_type="general-purpose" name="decomp-1"
Agent taskId="3" agent_type="general-purpose" name="decomp-2"
Agent taskId="4" agent_type="general-purpose" name="decomp-3"
Agent taskId="5" agent_type="general-purpose" name="decomp-4"
```

### 模式二：流水线模式

按执行顺序分配，形成处理流水线。

```bash
# 启动流水线：frida → extract → decompile → analyze
Agent taskId="1" agent_type="general-purpose" name="frida-runner"
Agent taskId="2" agent_type="general-purpose" name="extractor"
Agent taskId="3" agent_type="general-purpose" name="decompiler"
Agent taskId="4" agent_type="general-purpose" name="analyzer"
```

### 模式三：主从模式

一个协调者管理多个 worker。

```bash
# 主 agent 协调
Agent taskId="1" agent_type="general-purpose" name="coordinator"
# 从 agent 执行
Agent taskId="2" agent_type="general-purpose" name="worker-0"
Agent taskId="3" agent_type="general-purpose" name="worker-1"
```

### 结果汇总

```bash
# 收集 worker 结果
SendMessage type="message" recipient="decomp-0" content="请汇报结果"
SendMessage type="message" recipient="decomp-1" content="请汇报结果"

# 主 agent 汇总后生成报告
```

---

## Frida 脱壳实战经验

### Spawn vs Attach 模式

| 模式 | 命令 | 行为 | 适用性 |
|------|------|------|--------|
| spawn | `frida -U -f com.example.app` | 应用未启动时注入 | **壳检测会导致崩溃，不推荐** |
| attach | `frida -U com.example.app` | 应用已运行时注入 | **稳定，推荐使用** |

**实战发现**：
- Spawn 模式 (`-f`) 会触发壳检测，导致应用崩溃
- Attach 模式 (`-n` 或直接包名) 可以正常工作
- 使用 `--no-pause` 参数让应用继续运行

```bash
# 错误方式（会崩溃）
frida -U -f com.tencent.gamehelper.wuxia -l script.js --no-pause

# 正确方式（Attach 模式）
# 先手动启动应用，或用 spawn 后立即 attach
frida -U -n com.tencent.gamehelper.wuxia -l script.js
```

### unshell_dexdump.js 修复经验

原脚本存在的问题及修复：

| 问题 | 修复方案 |
|------|----------|
| 空值检查缺失 | 添加 `if (!ptr || ptr.isNull()) return;` |
| 延迟 hook | 等待 ClassLoader 加载完成后再 hook |
| 内存泄漏 | 及时 unlisten 避免重复注册 |

```javascript
// 修复示例：空值检查
var baseAddr = ptr(Module.findBaseAddress('libdexfile.so'));
if (!baseAddr || baseAddr.isNull()) {
    console.log('[-] libdexfile.so not found');
    return;
}

// 修复示例：延迟 hook
setTimeout(function() {
    Interceptor.attach(..., {
        onEnter: function(args) {
            // 检查参数有效性
        }
    });
}, 2000);
```

### 简化脚本策略

如果 `unshell_dexdump.js` 不稳定，可以创建简化版 `unshell_simple.js`：

```javascript
// unshell_simple.js - 只 hook Java 层，稳定不崩溃
Java.perform(function() {
    var ClassLoader = Java.use('dalvik.system.ClassLoader');
    ClassLoader.loadClass.overload('java.lang.String').implementation = function(className) {
        console.log('[+] Loading: ' + className);
        return this.loadClass(className);
    };
});
```

### Frida 脱壳完整流程

```bash
# 1. 启动应用（不使用 -f 避免崩溃）
adb shell am start -n com.tencent.gamehelper.wuxia/.MainActivity

# 2. 等待应用完全启动
sleep 3

# 3. Attach 到应用
frida -U -n com.tencent.gamehelper.wuxia -l frida_scripts/unshell_dexdump.js

# 4. 触发 DEX 加载（打开特定功能页面）
# ... 操作应用让目标类加载 ...

# 5. 提取 dump 的文件
adb exec-out cat /data/local/tmp/unshell/classes.dex > ./dumped/classes.dex
```

---

## DEX 文件提取实战经验

### 正确的二进制提取方式

| 方式 | 命令 | 结果 |
|------|------|------|
| **错误** | `adb shell cat /path/file` | 换行符转换导致二进制损坏 |
| **错误** | `adb pull /path/file` | 文件正在写入时损坏 |
| **正确** | `adb exec-out cat /path/file > output` | 原始字节正确传输 |

**原因分析**：
- `adb shell cat` 会对 `\n` 进行文本模式转换
- `adb pull` 在文件正在写入时会截断或损坏
- `adb exec-out` 直接传输原始字节流

```bash
# 正确提取二进制文件
adb exec-out cat /data/local/tmp/unshell/classes.dex > ./dumped/classes.dex

# 错误提取（损坏）
adb shell cat /data/local/tmp/unshell/classes.dex > ./dumped/classes.dex  # 损坏！
adb pull /data/local/tmp/unshell/classes.dex ./dumped/  # 可能损坏！
```

### 保证文件完整性的技巧

```bash
# 1. 提取前先关闭应用确保无写入
adb shell am force-stop com.tencent.gamehelper.wuxia
sleep 1

# 2. 提取后再重启应用
adb shell am start -n com.tencent.gamehelper.wuxia/.MainActivity
```

### 内存 Dump 的特殊性

从内存提取的 DEX 可能是半解密状态：

| 情况 | 表现 | 处理 |
|------|------|------|
| 完整 DEX | checksum 正常 | 直接使用 |
| 半解密 | checksum 校验失败 | 仍可尝试反编译 |
| 内存截断 | 文件不完整 | 无法使用 |

**注意**：DEX checksum 校验失败不等于文件无用，有时只是内存 dump 时的截断。

---

## Jadx 反编译实战经验

### 正确的启动方式

| 错误方式 | 正确方式 |
|----------|----------|
| `java -jar jadx-1.5.1-all.jar` (弹 GUI) | `java -cp jadx-1.5.1-all.jar jadx.cli.JadxCLI -d [output] [input]` |
| 阻塞当前终端 | 后台运行或用 `-d` 指定输出目录 |

```bash
# 错误：启动 GUI 弹窗（Windows 上会阻塞）
java -jar jadx-1.5.1-all.jar classes.dex

# 正确：命令行模式
java -cp jadx-1.5.1-all.jar jadx.cli.JadxCLI -d ./output classes.dex

# 正确：指定源码包名
java -cp jadx-1.5.1-all.jar jadx.cli.JadxCLI --skip-bad-code -d ./output classes.dex
```

### 常用参数

| 参数 | 说明 |
|------|------|
| `-d <dir>` | 指定输出目录 |
| `--skip-bad-code` | 跳过校验失败的代码块 |
| `--no-res` | 不输出资源 |
| `-r` | 递归处理整个目录 |

### DEX checksum 校验失败处理

```bash
# 方法1：使用 --skip-bad-code 跳过坏块
java -cp jadx-1.5.1-all.jar jadx.cli.JadxCLI --skip-bad-code -d ./output bad.dex

# 方法2：使用 dex2jar 作为备选
d2j-dex2jar.sh bad.dex -o bad.jar
# 然后用 jd-gui 查看 jar
```

---

## 项目特定发现

### 天刀助手 APK 结构

| 文件/目录 | 说明 |
|-----------|------|
| `classes.dex` | 壳 DEX，文件头是 `dex.035`（不是真正的 DEX） |
| `assets/0OO00l111l1l` | 真正加密的 DEX (19MB) |
| `lib/arm64-v8a/libshell-super.so` | 腾讯乐固壳 SO |
| `lib/arm64-v8a/libckguard.so` | 梆梆加固核心 SO |
| `libflutter.so` | Flutter 引擎 |

### 关键特征

- **包名**：`com.tencent.gamehelper.wuxia`
- **架构**：Flutter 应用 (`libflutter.so`)
- **加固**：腾讯乐固 4.6.2.2 + 梆梆加固
- **主 API**：`https://api2.helper.qq.com`

### 反编译目录结构

```
apk_decompile/
├── lib/
│   └── arm64-v8a/
│       ├── libapp.so          # 反编译的 Flutter 代码
│       ├── libflutter.so      # Flutter 引擎
│       └── libshell-super.so  # 腾讯乐固壳
└── ...
```

---

## 坑和注意事项

### 1. jadx 启动方式

| 错误方式 | 正确方式 |
|----------|----------|
| `java -jar jadx.jar` (弹 GUI) | `java -cp jadx.jar jadx.cli.JadxCLI -d [output] [input]` |
| 阻塞当前终端 | 后台运行或用 `-d` 指定输出目录 |

### 2. adb 提取二进制文件

| 错误方式 | 正确方式 |
|----------|----------|
| `adb shell cat /path/to/file` | `adb exec-out cat /path/to/file > output` |
| `adb pull /path/to/file` (正在写入时) | 先 `am force-stop` 再提取 |
| 会损坏二进制数据 | 正确提取原始字节 |

**原因**：`adb shell cat` 会对二进制数据做文本转换，导致文件损坏。

### 3. Frida spawn 模式崩溃

| 错误方式 | 正确方式 |
|----------|----------|
| `frida -U -f com.example.app` | 先手动启动，再用 `frida -U -n` attach |
| 会触发壳检测崩溃 | Attach 模式稳定 |

### 4. agent 关闭后 UI 延迟

agent 收到 `shutdown_request` 并响应后：
- 终端可能延迟几秒更新
- 任务状态可能不会立即变更
- 等待或手动刷新

### 5. 消息传递限制

- 普通文本输出对其他 agent **不可见**
- 必须使用 `SendMessage` 才能跨 agent 通信
- 每个 agent 独立上下文，不共享内存

### 6. 任务持久性

- 任务状态持久存储
- agent 重启后可继续未完成的任务
- 使用 `TaskGet` 检查任务历史

### 7. 并行任务隔离性

- 5 个 DEX 并行反编译时，一个文件失败不影响其他
- Agent 之间完全隔离
- 需要单独处理失败的任务

---

## 实际案例

### 案例一：5 个 DEX 并行反编译

```bash
# 1. 创建团队
TeamCreate
# 返回: team-xyz-789

# 2. 创建 5 个任务
TaskCreate subject="反编译 classes1.dex" description="使用 jadx 反编译 classes1.dex"
TaskCreate subject="反编译 classes2.dex" description="使用 jadx 反编译 classes2.dex"
TaskCreate subject="反编译 classes3.dex" description="使用 jadx 反编译 classes3.dex"
TaskCreate subject="反编译 classes4.dex" description="使用 jadx 反编译 classes4.dex"
TaskCreate subject="反编译 classes5.dex" description="使用 jadx 反编译 classes5.dex"

# 3. 启动 5 个 agent 并行
Agent taskId="1" agent_type="general-purpose" name="decomp-0"
Agent taskId="2" agent_type="general-purpose" name="decomp-1"
Agent taskId="3" agent_type="general-purpose" name="decomp-2"
Agent taskId="4" agent_type="general-purpose" name="decomp-3"
Agent taskId="5" agent_type="general-purpose" name="decomp-4"

# 4. 各 agent 执行命令示例
# decomp-0: java -cp jadx.jar jadx.cli.JadxCLI -d ./output1 classes1.dex
# decomp-1: java -cp jadx.jar jadx.cli.JadxCLI -d ./output2 classes2.dex
# ...

# 5. 收集结果
SendMessage type="message" recipient="decomp-0" content="请汇报结果"
SendMessage type="message" recipient="decomp-1" content="请汇报结果"
# ...

# 6. 请求关闭
SendMessage type="shutdown_request" recipient="decomp-0" content="任务完成"
SendMessage type="shutdown_request" recipient="decomp-1" content="任务完成"
# ...
```

**实战结果**：5 个 DEX 并行反编译，提速明显，个别失败不影响其他。

### 案例二：任务失败处理

```bash
# agent decomp-2 报告失败（checksum 错误）
SendMessage type="message" recipient="decomp-2" content="classes3.dex checksum 失败，尝试 --skip-bad-code"

# 或重新创建任务
TaskCreate subject="重试反编译 classes3.dex" description="上次 checksum 失败，使用 dex2jar 备选"

# 分配给新的 agent
Agent taskId="6" agent_type="general-purpose" name="decomp-retry"

# 换方法：使用 dex2jar + jd-gui
SendMessage type="message" recipient="decomp-retry" content="jadx 失败，使用 d2j-dex2jar.sh 转换"
```

### 案例三：Frida 脱壳完整流程

```bash
# 1. 启动应用（避免 spawn 模式）
adb shell am start -n com.tencent.gamehelper.wuxia/.MainActivity
sleep 3

# 2. Attach 脱壳脚本
frida -U -n com.tencent.gamehelper.wuxia -l frida_scripts/unshell_dexdump.js

# 3. 操作应用触发 DEX 加载
# 在应用内打开特定功能页面

# 4. 提取 dump 的文件
adb exec-out cat /data/local/tmp/unshell/classes.dex > ./dumped/classes.dex

# 5. 如需确保文件完整，先关闭应用
adb shell am force-stop com.tencent.gamehelper.wuxia
adb exec-out cat /data/local/tmp/unshell/classes.dex > ./dumped/classes.dex
```

### 案例四：文档更新 agent

```bash
# 1. 创建文档更新任务
TaskCreate subject="更新逆向分析文档" description="更新天刀助手 APK 逆向分析报告，增加最新发现"

# 2. 启动文档 agent
Agent taskId="7" agent_type="general-purpose" name="doc-updater"

# 3. 文档 agent 工作内容
# - 读取现有文档：天刀助手APK逆向分析报告.md
# - 追加新内容：libckguard.so 发现、Frida 脱壳结果等
# - 更新发现列表

# 4. 主 agent 验证更新
```

### 案例五：协同研究

```bash
# 1. 启动探索 agent 深入研究 libflutter.so
Agent taskId="1" agent_type="Explore" name="flutter-explorer"

# 2. 探索 agent 发现关键函数后通知主 agent
SendMessage type="message" recipient="team-lead" content="发现 Flutter 引擎入口点，分析报告中..."

# 3. 主 agent 启动代码生成 agent
Agent taskId="2" agent_type="general-purpose" name="frida-scripter"

# 4. frida-scripter 基于探索结果生成 Hook 脚本
```

---

## 快速参考

### 启动 agent 最小模板

```bash
# 创建团队
TeamCreate

# 创建任务
TaskCreate subject="任务描述" description="详细说明"

# 启动 agent
Agent taskId="1" agent_type="general-purpose" name="worker"

# 发送消息
SendMessage type="message" recipient="worker" content="开始工作"

# 关闭 agent
SendMessage type="shutdown_request" recipient="worker" content="任务完成"
```

### 常用命令速查

| 操作 | 命令 |
|------|------|
| 查看任务 | `TaskList` |
| 查看详情 | `TaskGet taskId="1"` |
| 标记进行中 | `TaskUpdate taskId="1" status="in_progress"` |
| 标记完成 | `TaskUpdate taskId="1" status="completed"` |
| 发送消息 | `SendMessage type="message" recipient="worker" content="..."` |
| 请求关闭 | `SendMessage type="shutdown_request" recipient="worker"` |

---

## 标准流程（必须遵循）

### 1. Agent 启动标准模板

**每次创建 agent 时，prompt 必须包含以下内容：**

```markdown
# 团队成员：worker-a, worker-b, worker-c
- 发现问题时：直接与相关成员通信协调，不要等待 team-lead 中转
- 有重要发现时：及时通知 team-lead，同时也可通知相关成员
- 遇到困难时：先尝试与团队成员协作解决
```

### 2. Team-Lead 行为准则（强制）

**team-lead 禁止亲自执行搜索、读取文件等操作，必须委托给 agent！**

| 错误做法（team-lead 亲自动手） | 正确做法（委托给 agent） |
|------------------------------|------------------------|
| 自己用 Grep/Read 搜索代码 | 创建 `code-searcher` agent 执行 |
| 自己读取文件分析 | 创建 `analyzer` agent 执行 |
| 自己运行命令测试 | 创建 `tester` agent 执行 |
| 自己整理文档 | 创建 `doc-writer` agent 执行 |

**原则**：team-lead 只做决策、分配任务、协调 agent，不做执行性工作。

### 3. Agent 关闭标准流程

```
1. 任务完成后 → 向 team-lead 发送结果报告
2. team-lead 确认后 → 发送 shutdown_request
3. agent 响应 shutdown_approved → 任务正式结束
```

### 4. Git 提交规范（强制）

**所有提交前必须先经过 git-reviewer 审查！**

```bash
# 提交流程
1. 功能代码修改完成
2. 发送给 git-reviewer 审查
3. 审查通过后才能 commit
4. git add <修改的文件>
5. git commit -m "feat: 完成XXX功能"
6. git push（如需要）
```

**type 类型**：feat(新功能), fix(修复), refactor(重构), docs(文档), chore(杂项)

**禁止**：
- ❌ 不经审查直接提交
- ❌ 一次性提交大量修改
- ❌ commit message 写 "update"

### 5. 协作检查清单

- [ ] Agent 启动时是否告知了团队成员列表？
- [ ] Agent 是否被指示可以直接互相通信？
- [ ] 是否有明确的汇报对象（team-lead vs 直接协作）？
- [ ] 复杂任务是否分解为可并行的子任务？

### Frida 命令速查

| 操作 | 命令 |
|------|------|
| Attach 模式 | `frida -U -n com.example.app -l script.js` |
| Spawn 模式（不推荐） | `frida -U -f com.example.app -l script.js --no-pause` |
| 查看进程 | `frida-ps -U` |

### Jadx 命令速查

| 操作 | 命令 |
|------|------|
| 命令行反编译 | `java -cp jadx.jar jadx.cli.JadxCLI -d output input.dex` |
| 跳过坏块 | `java -cp jadx.jar jadx.cli.JadxCLI --skip-bad-code -d output input.dex` |

### adb 提取命令速查

| 操作 | 命令 |
|------|------|
| 二进制提取 | `adb exec-out cat /path/file > output` |
| 关闭应用 | `adb shell am force-stop com.example.app` |
| 启动应用 | `adb shell am start -n com.example.app/.MainActivity` |

---

## 常见问题

**Q: agent 之间如何共享数据？**
A: 通过文件系统共享，各 agent 独立上下文，无法直接内存共享。

**Q: 一个 agent 能处理多个任务吗？**
A: 可以，但不推荐。建议 1:1 映射以保持清晰的任务边界。

**Q: agent 崩溃了怎么办？**
A: 任务状态保持不变，可以重新启动 agent 继续，或标记失败后创建新任务。

**Q: 如何知道 agent 是否完成？**
A: 查看 `TaskList`，或向 agent 发送消息询问状态。

**Q: DEX checksum 校验失败怎么办？**
A: 尝试 `--skip-bad-code` 参数，或使用 dex2jar 作为备选工具。

**Q: Frida spawn 模式崩溃怎么办？**
A: 改用 attach 模式：先手动启动应用，再用 `frida -U -n` attach。
