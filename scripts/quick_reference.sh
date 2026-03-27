#!/bin/bash
# quick_reference.sh - 快速参考命令卡
#
# 在模拟器上运行的常用命令

echo "
==========================================
UnShellX - 快速参考命令
==========================================

## 环境检查

# 检查 adb
adb version

# 检查设备
adb devices

# 检查 Frida
frida --version

## 安装 APK

# 安装 APK
adb install base.apk

# 重新安装（保留数据）
adb install -r base.apk

## 脱壳操作

# 启动应用并注入脱壳脚本
frida -U -f com.tencent.gamehelper.wuxia \\
      -l /data/local/tmp/unshell/unshell_dexdump.js \\
      --no-pause

# 附加到已运行进程
frida -U com.tencent.gamehelper.wuxia \\
      -l /data/local/tmp/unshell/unshell_dexdump.js

## 文件提取

# 查看远程目录
adb shell ls -la /data/local/tmp/unshell/

# 提取目录
adb pull /data/local/tmp/unshell/ ./dumped/

# 提取单个文件
adb pull /data/local/tmp/unshell/classes.dex ./

## 应用操作

# 启动应用
adb shell am start -n com.tencent.gamehelper.wuxia/.MainActivity

# 停止应用
adb shell am force-stop com.tencent.gamehelper.wuxia

# 查看应用数据目录
adb shell run-as com.tencent.gamehelper.wuxia ls -la

# 进入 shell
adb shell

## 反编译

# 使用 jadx-gui
jadx-gui ./dumped/classes.dex

# 使用 apktool
apktool d base.apk -o decoded/

# 使用 dex2jar
d2j-dex2jar.sh ./dumped/classes.dex -o ./classes.jar

==========================================
"