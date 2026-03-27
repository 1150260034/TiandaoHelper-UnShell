# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库工作时提供指导。

## 项目概述

UnShellX 是一个逆向工程项目，用于对 **天刀助手** (TiandaoHelper) APK 进行脱壳和反编译。该应用使用 **腾讯乐固 4.6.2.2 + 梆梆加固** 进行保护。

**目标应用**: `com.tencent.gamehelper.wuxia`
**目标**: 提取解密后的 DEX 文件并反编译为 Java 源码

## 常用命令

### Frida 脱壳（Android 模拟器/ROOT 设备）
```bash
# 启动应用并注入脱壳脚本
frida -U -f com.tencent.gamehelper.wuxia \
      -l frida_scripts/unshell_dexdump.js --no-pause

# 提取脱出的文件
adb pull /data/local/tmp/unshell/ ./dumped/
```

### 反编译
```bash
# 使用 jadx（推荐）
jadx-gui ./dumped/classes.dex

# 或使用 apktool（加固 APK 可能失败）
apktool d base.apk -o decoded/
```

### 脚本
```bash
# 完整流程：脱壳 + 提取 + 反编译
./scripts/full_pipeline.sh

# 快速脱壳和提取
./scripts/unshell_and_pull.sh [超时秒数]
```

## 项目架构

```
frida_scripts/     # Frida JS 脚本，用于 Hook ClassLoader/DexFile/native 层
scripts/          # Shell/Batch 自动化脚本
tools/            # 需下载的工具（jadx, apktool, dex2jar）
```

## 关键发现

- **壳 DEX**: `classes.dex` 文件头为 `dex.035`（不是真正的 DEX）
- **加密 DEX**: `assets/0OO00l111l1l` (19MB) 包含真正的 DEX
- **壳 SO**: `lib/arm64-v8a/libshell-super.com.tencent.gamehelper.wuxia.so`

## 注意事项

- Frida 脚本 Hook 了 `ClassLoader.loadClass`、`DexFile` 和 native 层 `android_dlopen_ext`
- `~/` 下的全局 `.gitignore` 会忽略 `*.md` 文件 - 提交 md 文件需使用 `git add -f`
- 工具（jadx, apktool, dex2jar）需下载到 `tools/` 目录，详见 `tools/README.md`
