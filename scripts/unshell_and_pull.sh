#!/bin/bash
# unshell_and_pull.sh - 脱壳并提取 Dex 到本地
#
# 用法: ./scripts/unshell_and_pull.sh [TIMEOUT]
#   TIMEOUT: 等待时间(秒)，默认60

PACKAGE="com.tencent.gamehelper.wuxia"
REMOTE_DIR="/data/local/tmp/unshell"
LOCAL_DIR="./dumped"
TIMEOUT=${1:-60}

echo "=========================================="
echo "UnShellX - 脱壳并提取"
echo "=========================================="
echo "[*] 包名: $PACKAGE"
echo "[*] 远程目录: $REMOTE_DIR"
echo "[*] 本地目录: $LOCAL_DIR"
echo "[*] 等待时间: ${TIMEOUT}秒"
echo "=========================================="

# 检查 adb
if ! command -v adb &> /dev/null; then
    echo "[E] adb 未找到!"
    exit 1
fi

# 检查 Frida
if ! command -v frida &> /dev/null; then
    echo "[E] frida 未找到!"
    exit 1
fi

# 检查设备
DEVICE_COUNT=$(adb devices | grep -c "device$" || true)
if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "[E] 没有检测到设备!"
    exit 1
fi
echo "[*] 设备检测成功"

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 创建本地目录
mkdir -p "$LOCAL_DIR"

# 清空远程目录
echo "[*] 清空远程目录..."
adb shell rm -rf "$REMOTE_DIR"/* 2>/dev/null || adb shell mkdir -p "$REMOTE_DIR"
adb shell rm -rf "$REMOTE_DIR"/*

# 推送脚本
echo "[*] 推送 Frida 脚本..."
adb push "$PROJECT_DIR/frida_scripts/unshell_dexdump.js" "$REMOTE_DIR/"

# 确认推送成功
adb shell ls -la "$REMOTE_DIR/"

# 启动 Frida 脱壳
echo "[*] 启动 Frida 脱壳..."
echo "[*] 请在应用中进行操作，触发类加载..."
echo "[*] ${TIMEOUT} 秒后自动提取..."

# 使用 spawn 模式启动
gnome-terminal -- bash -c "frida -U -f $PACKAGE \
    -l $REMOTE_DIR/unshell_dexdump.js \
    --no-pause 2>&1 | tee /tmp/frida_log.txt" &

# 或者直接后台运行
# frida -U -f "$PACKAGE" -l "$REMOTE_DIR/unshell_dexdump.js" --no-pause &
FRIDA_PID=$!

# 等待用户操作
echo "[*] 等待 ${TIMEOUT} 秒..."
sleep "$TIMEOUT"

# 停止 Frida
if ps -p $FRIDA_PID > /dev/null 2>&1; then
    echo "[*] 停止 Frida..."
    kill $FRIDA_PID 2>/dev/null
fi

# 提取文件
echo "[*] 提取脱壳文件..."
adb pull "$REMOTE_DIR/" "$LOCAL_DIR/" 2>/dev/null || echo "[!] 没有文件被提取"

# 显示结果
echo ""
echo "=========================================="
echo "[*] 提取结果:"
echo "=========================================="
ls -la "$LOCAL_DIR/"

# 统计 Dex 文件
DEX_COUNT=$(find "$LOCAL_DIR" -name "*.dex" 2>/dev/null | wc -l)
echo ""
echo "[*] 发现 $DEX_COUNT 个 Dex 文件"

if [ "$DEX_COUNT" -gt 0 ]; then
    echo "[*] Dex 文件列表:"
    find "$LOCAL_DIR" -name "*.dex" -exec ls -lh {} \;
fi

echo ""
echo "[*] 完成!"