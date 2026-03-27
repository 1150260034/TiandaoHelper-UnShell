# UnShellX - 天刀助手脱壳与反编译

> 目标：获取天刀助手完整 Java 源码

## 项目结构

```
UnShellX/
├── README.md              # 本文件
├── RESEARCH.md            # 详细研究文档
├── base.apk               # 目标 APK (134MB)
├── frida_scripts/
│   ├── unshell_frida.js   # 基础脱壳脚本
│   └── unshell_dexdump.js  # 增强脱壳脚本 v2
├── scripts/
│   ├── unshell_and_pull.sh      # 脱壳并提取 (Linux/macOS)
│   ├── unshell_and_pull.bat     # 脱壳并提取 (Windows)
│   ├── full_pipeline.sh         # 完整流水线
│   └── quick_reference.sh        # 快速命令参考
└── tools/                 # 工具目录 (需下载)
    ├── jadx/             # Dex 反编译工具
    ├── apktool/          # APK 反编译工具
    └── dex2jar/          # Dex 转 Jar 工具
```

## 工作流程

```
1. 安装 APK 到模拟器
2. 运行 Frida 脱壳脚本
3. 提取脱出的 Dex 文件
4. 使用 jadx 反编译为 Java 源码
```

## 快速开始

### 1. 环境准备

```bash
# 安装 Frida
pip install frida-tools

# 确认 adb 可用
adb version
```

### 2. 脱壳

```bash
# 推送脚本到模拟器
adb push frida_scripts/unshell_dexdump.js /data/local/tmp/unshell/

# 启动应用并脱壳
frida -U -f com.tencent.gamehelper.wuxia \
      -l /data/local/tmp/unshell/unshell_dexdump.js \
      --no-pause

# 操作应用后，提取文件
adb pull /data/local/tmp/unshell/ ./dumped/
```

### 3. 反编译

```bash
# 使用 jadx-gui 打开
jadx-gui ./dumped/classes.dex

# 或使用命令行
jadx ./dumped/classes.dex -d ./source/
```

## 详细文档

参见 [RESEARCH.md](RESEARCH.md)

## 工具下载

| 工具 | 下载地址 |
|------|----------|
| Frida | `pip install frida-tools` |
| jadx | https://github.com/skylot/jadx/releases |
| apktool | https://apktool.org |
| dex2jar | https://github.com/pxb1988/dex2jar |

## 目标信息

| 项目 | 值 |
|------|-----|
| 应用名称 | 天刀助手 |
| 包名 | `com.tencent.gamehelper.wuxia` |
| 壳类型 | 腾讯乐固 4.6.2.2 + 梆梆加固 |
| APK 大小 | 134 MB |