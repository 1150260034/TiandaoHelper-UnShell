# UnShellX 研究文档

> 天刀助手乐固加固壳脱壳与反编译
>
> **最终目标**: 获取天刀助手完整源码

**研究日期**: 2026-03-27
**目标 APK**: base.apk (天刀助手)
**壳类型**: 腾讯乐固 + 梆梆加固 组合壳
**工作环境**: Android 模拟器 (adb 可用)

---

## 目录

1. [APK 基本信息](#1-apk-基本信息)
2. [壳特征分析](#2-壳特征分析)
3. [工作流程概览](#3-工作流程概览)
4. [环境准备](#4-环境准备)
5. [第一步：脱壳](#5-第一步脱壳)
6. [第二步：提取 Dex](#6-第二步提取-dex)
7. [第三步：反编译](#7-第三步反编译)
8. [完整一键脚本](#8-完整一键脚本)
9. [参考项目](#9-参考项目)

---

## 1. APK 基本信息

### 1.1 文件信息

| 项目 | 值 |
|------|-----|
| APK 路径 | `base.apk` |
| APK 大小 | 134 MB |
| 包名 | `com.tencent.gamehelper.wuxia` |
| 壳类型 | 腾讯乐固 4.6.2.2 + 梆梆加固 |

### 1.2 APK 结构

```
base.apk/
├── classes.dex              # 70KB (壳DEX, 文件头: dex.035)
├── classes2-5.dex           # 2.4KB x 4 (壳片段)
├── AndroidManifest.xml      # 加固加密
├── resources.arsc           # 资源文件
├── assets/
│   ├── 0OO00l111l1l         # 19MB 加密数据 (核心DEX)
│   ├── libwbsafeedit*       # 梆梆安全库
│   ├── t86, t86_64          # x86 SO
│   └── o0oooOO0ooOo.dat    # 壳配置
└── lib/
    └── arm64-v8a/
        ├── libshell-super.com.tencent.gamehelper.wuxia.so  # 乐固主壳
        └── libshella-4.6.2.2.so                            # 乐固壳辅助
```

---

## 2. 壳特征分析

| 特征 | 值 |
|------|-----|
| 壳名称 | 腾讯乐固 (Legu) + 梆梆加固 |
| 主壳 SO | `libshell-super.com.tencent.gamehelper.wuxia.so` (360KB) |
| 壳版本 | `libshella-4.6.2.2.so` |
| 加密 DEX | `assets/0OO00l111l1l` (19MB) |
| classes.dex 头 | `dex.035` (壳特征) |

---

## 3. 工作流程概览

```
┌─────────────────────────────────────────────────────────────┐
│                      完整工作流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. [安装 APK]                                              │
│         │                                                   │
│         ▼                                                   │
│  2. [Frida 脱壳] ──► 运行 unshell_dexdump.js               │
│         │                                                   │
│         ▼                                                   │
│  3. [提取 Dex] ───► 从模拟器 pull 脱出的 dex 文件          │
│         │                                                   │
│         ▼                                                   │
│  4. [反编译] ─────► 使用 jadx-gui 或 apktool               │
│         │                                                   │
│         ▼                                                   │
│  5. [获取源码] ───► 导出为 Java 源代码                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 环境准备

### 4.1 需要的工具

在模拟器设备上安装/配置以下工具：

```bash
# 1. 安装 Frida
pip install frida-tools

# 2. 安装 adb (已可用)
# 确认 adb 可用
adb version

# 3. 检查设备连接
adb devices
```

### 4.2 推送必要文件到模拟器

```bash
# 创建工作目录
adb shell mkdir -p /data/local/tmp/unshell

# 推送 Frida 脚本
adb push frida_scripts/unshell_dexdump.js /data/local/tmp/unshell/

# 确认推送成功
adb shell ls -la /data/local/tmp/unshell/
```

### 4.3 推送原 APK 到模拟器

```bash
# 推送 APK 到模拟器
adb push base.apk /sdcard/

# 或安装 APK
adb install base.apk
```

---

## 5. 第一步：脱壳

### 5.1 启动 Frida 脱壳

**方法一：Spawn 模式（推荐，首次启动）**

```bash
# 启动应用并注入脱壳脚本
frida -U -f com.tencent.gamehelper.wuxia \
      -l frida_scripts/unshell_dexdump.js \
      --no-pause \
      -o /tmp/unshell_log.txt
```

**方法二：Attach 模式（附加到已运行进程）**

```bash
# 先启动应用
adb shell am start -n com.tencent.gamehelper.wuxia/.MainActivity

# 等待几秒后附加
frida -U com.tencent.gamehelper.wuxia \
      -l frida_scripts/unshell_dexdump.js
```

### 5.2 触发类加载

运行应用并触发以下操作以加载尽可能多的类：

- 打开应用主界面
- 登录账号
- 进入游戏详情页
- 点击各个功能按钮

Frida 会监控并输出类加载信息。

### 5.3 提取脱壳文件

```bash
# 查看脱壳目录
adb shell ls -la /data/local/tmp/unshell/

# 提取所有脱出的文件
adb pull /data/local/tmp/unshell/ ./dumped/

# 查看提取结果
ls -la ./dumped/
```

---

## 6. 第二步：提取 Dex

### 6.1 如果 Frida 未能自动脱出 Dex

可以尝试手动提取：

```bash
# 方式1：直接从应用私有目录提取
adb shell run-as com.tencent.gamehelper.wuxia \
    ls -la /data/data/com.tencent.gamehelper.wuxia/files/

adb shell run-as com.tencent.gamehelper.wuxia \
    cat /data/data/com.tencent.gamehelper.wuxia/files/*.dex > /sdcard/dumped.dex

adb pull /sdcard/dumped.dex ./
```

```bash
# 方式2：使用 bugreport 获取内存
adb bugreport > bugreport.zip
# 然后从 bugreport 中搜索 dex 数据
```

### 6.2 处理多个 Dex 文件

如果脱出多个 dex 文件（如 classes.dex, classes2.dex 等）：

```bash
# 合并到一个目录
mkdir -p ./dumped_dex/
mv ./dumped/*.dex ./dumped_dex/

# 重命名（如果需要）
cd ./dumped_dex/
ls -la
```

---

## 7. 第三步：反编译

### 7.1 使用 jadx-gui（推荐，功能最全）

**安装 jadx：**

```bash
# 下载 jadx 最新版
# https://github.com/skylot/jadx/releases

# 或使用 gradle 构建
git clone https://github.com/skylot/jadx.git
cd jadx
./gradlew dist
```

**启动 jadx-gui：**

```bash
# macOS/Linux
./build/jadx-gui/bin/jadx-gui &

# Windows
./build/jadx-gui/bin/jadx-gui.bat
```

**打开 Dex 文件：**

1. 启动 jadx-gui
2. File -> Open -> 选择 `dumped_dex/classes.dex`
3. 等待反编译完成
4. 导航到想要查看的类

### 7.2 使用 apktool（命令行）

**安装 apktool：**

```bash
# 下载 apktool.jar 和 apktool.bat
# https://apktool.org/

# Linux/macOS
chmod +x apktool.jar
./apktool version

# Windows
apktool.bat version
```

**反编译 APK：**

```bash
# 反编译 APK (注意：加固的 APK 可能失败)
./apktool d base.apk -o base_decoded/

# 如果上面的命令失败，尝试只反编译资源
./apktool d -r base.apk -o base_decoded/
```

### 7.3 使用 d2j-dex2jar 转为 Jar

```bash
# 下载 d2j-dex2jar
# https://github.com/pxb1988/dex2jar

# 转换 Dex 到 Jar
./d2j-dex2jar.sh ./dumped_dex/classes.dex -o ./classes.jar

# 使用 JD-GUI 查看 Jar
./jd-gui ./classes.jar
```

### 7.4 一键反编译脚本

```bash
#!/bin/bash
# decompile.sh - 一键反编译脚本

DUMP_DIR="./dumped_dex"
OUTPUT_DIR="./decompiled"

mkdir -p "$OUTPUT_DIR"

echo "[*] 查找 Dex 文件..."
find "$DUMP_DIR" -name "*.dex" -type f | while read dexfile; do
    echo "[*] 处理: $dexfile"
    filename=$(basename "$dexfile" .dex)

    # 转换为 Jar
    echo "[*] 转换为 Jar..."
    ./d2j-dex2jar.sh "$dexfile" -o "$OUTPUT_DIR/${filename}.jar"
done

echo "[*] 完成! Jar 文件位于: $OUTPUT_DIR/"
echo "[*] 使用 JD-GUI 打开查看: ./jd-gui"
```

---

## 8. 完整一键脚本

### 8.1 脱壳 + 提取脚本 (unshell_and_pull.sh)

```bash
#!/bin/bash
# unshell_and_pull.sh - 脱壳并提取 Dex

PACKAGE="com.tencent.gamehelper.wuxia"
REMOTE_DIR="/data/local/tmp/unshell"
LOCAL_DIR="./dumped"

echo "=========================================="
echo "UnShellX - 脱壳并提取"
echo "=========================================="

# 创建本地目录
mkdir -p "$LOCAL_DIR"

# 清空远程目录
adb shell rm -rf "$REMOTE_DIR/*"

# 推送脚本
adb push frida_scripts/unshell_dexdump.js "$REMOTE_DIR/"

# 启动 Frida 脱壳 (后台运行一段时间)
echo "[*] 启动脱壳，请操作应用..."
frida -U -f "$PACKAGE" \
      -l "$REMOTE_DIR/unshell_dexdump.js" \
      --no-pause &
FRIDA_PID=$!

# 等待 60 秒（让用户操作应用）
sleep 60

# 停止 Frida
kill $FRIDA_PID 2>/dev/null

# 提取文件
echo "[*] 提取脱壳文件..."
adb pull "$REMOTE_DIR/" "$LOCAL_DIR/"

echo "[*] 完成! 文件位于: $LOCAL_DIR/"
ls -la "$LOCAL_DIR/"
```

### 8.2 完整流水线脚本 (full_pipeline.sh)

```bash
#!/bin/bash
# full_pipeline.sh - 完整脱壳+反编译流水线

set -e

WORK_DIR="./tiandao_output"
PACKAGE="com.tencent.gamehelper.wuxia"

echo "=========================================="
echo "UnShellX - 完整流水线"
echo "=========================================="

# 创建工作目录
mkdir -p "$WORK_DIR"/{dumped,decompiled,project}

cd "$WORK_DIR"

# 步骤1：脱壳
echo "[*] 步骤1：脱壳..."
bash ../unshell_and_pull.sh

# 步骤2：反编译
echo "[*] 步骤2：反编译 Dex..."
for dex in ./dumped/*.dex; do
    if [ -f "$dex" ]; then
        echo "[*] 处理: $dex"
        ../tools/d2j-dex2jar.sh "$dex" -o "./decompiled/$(basename $dex .dex).jar"
    fi
done

echo "[*] 完成!"
echo "[*] 反编译结果: $WORK_DIR/decompiled/"
echo "[*] 使用 JD-GUI 打开 .jar 文件查看源码"
```

---

## 9. 参考项目

| 项目 | 地址 |
|------|------|
| ApkShelling (Xposed脱壳) | https://github.com/OakChen/ApkShelling |
| Frida | https://frida.re |
| jadx (Dex反编译) | https://github.com/skylot/jadx |
| apktool | https://apktool.org |
| dex2jar | https://github.com/pxb1988/dex2jar |
| JD-GUI | https://jd-gui.github.io/ |

---

## 附录 A: 常见问题

### Q1: Frida 连接不上设备

```bash
# 重启 adb 服务
adb kill-server
adb start-server

# 检查设备
adb devices
```

### Q2: 应用启动后立即崩溃

可能是壳检测到调试，尝试：
- 关闭应用的调试权限
- 使用 spawn 模式而非 attach

### Q3: 脱壳脚本没有吐出 Dex

乐固壳可能需要特定时机：
- 确保应用完全启动后再操作
- 尝试触发更多类加载
- 查看 Frida 控制台输出

### Q4: 如何确认脱壳成功？

```bash
# 检查 Dex 文件大小
ls -la ./dumped/*.dex

# 正常 Dex 应该 > 1MB
# 壳 Dex 通常只有几 KB

# 使用 file 命令检查
file ./dumped/classes.dex
# 正常:classes.dex: Dalvik DEX file
```

---

## 附录 B: 关键文件路径

| 描述 | 路径 |
|------|------|
| 壳主 SO | `lib/arm64-v8a/libshell-super.com.tencent.gamehelper.wuxia.so` |
| 壳辅助 SO | `lib/arm64-v8a/libshella-4.6.2.2.so` |
| 梆梆库 | `assets/libwbsafeedit*` |
| 加密 DEX | `assets/0OO00l111l1l` (19MB) |
| 壳配置 | `assets/o0oooOO0ooOo.dat` |

---

## 附录 C: 目标应用信息

| 项目 | 值 |
|------|-----|
| 应用名称 | 天刀助手 |
| 包名 | `com.tencent.gamehelper.wuxia` |
| 主 Activity | (待确认，通常是 MainActivity) |
|壳类型 | 腾讯乐固 4.6.2.2 + 梆梆加固 |
