#!/bin/bash
# UnShellX - 快速启动 Frida 脱壳脚本

# 配置
PACKAGE="com.tencent.gamehelper.wuxia"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "UnShellX - 乐固壳脱壳工具"
echo "=========================================="

# 检查 frida 是否安装
if ! command -v frida &> /dev/null; then
    echo "[E] frida 未安装!"
    echo "请运行: pip install frida-tools"
    exit 1
fi

# 检查设备连接
echo "[*] 检查设备连接..."
frida-ps -U > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "[E] 没有检测到 USB 设备!"
    echo "请确保:"
    echo "  1. 手机已通过 USB 连接"
    echo "  2. USB 调试已开启"
    echo "  3. 已运行 'adb devices'"
    exit 1
fi

echo "[*] 设备已连接"

# 解析参数
MODE=${1:-"spawn"}

case $MODE in
    "spawn")
        echo "[*] 模式: Spawn (启动新进程)"
        echo "[*] 包名: $PACKAGE"
        echo "[*] 脚本: unshell_dexdump.js"
        echo ""
        echo "启动中..."
        frida -U -f $PACKAGE -l "$SCRIPT_DIR/unshell_dexdump.js" --no-pause
        ;;
    "attach")
        echo "[*] 模式: Attach (附加到已运行进程)"
        echo "[*] 包名: $PACKAGE"
        echo "[*] 脚本: unshell_dexdump.js"
        echo ""
        echo "附加中..."
        frida -U $PACKAGE -l "$SCRIPT_DIR/unshell_dexdump.js"
        ;;
    "list")
        echo "[*] 列出已连接的设备上的应用"
        frida-ps -U
        ;;
    *)
        echo "用法: $0 [spawn|attach|list]"
        echo ""
        echo "  spawn  - 启动新进程并注入 (默认)"
        echo "  attach - 附加到已运行的进程"
        echo "  list   - 列出已连接设备上的应用"
        exit 1
        ;;
esac