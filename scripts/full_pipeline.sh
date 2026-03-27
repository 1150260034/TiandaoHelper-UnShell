#!/bin/bash
# full_pipeline.sh - 完整脱壳+反编译流水线
#
# 用法: ./scripts/full_pipeline.sh
#
# 流程:
#   1. 使用 Frida 脱壳
#   2. 提取 Dex 文件
#   3. 反编译为 Java 源码

set -e

WORK_DIR="./tiandao_output"
PACKAGE="com.tencent.gamehelper.wuxia"

echo "=========================================="
echo "UnShellX - 完整流水线"
echo "=========================================="
echo "[*] 工作目录: $WORK_DIR"
echo "[*] 目标包名: $PACKAGE"
echo "=========================================="

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 创建工作目录
mkdir -p "$WORK_DIR"/{dumped,decompiled,project}

cd "$WORK_DIR"

# 检查 d2j-dex2jar 是否存在
DEX2JAR="$PROJECT_DIR/tools/d2j-dex2jar.sh"
if [ ! -f "$DEX2JAR" ]; then
    echo "[!] 警告: d2j-dex2jar 未找到"
    echo "[*] 请下载 dex2jar: https://github.com/pxb1988/dex2jar"
    echo "[*] 解压后将 d2j-dex2jar.sh 放到 tools/ 目录"
    echo ""
fi

# 步骤1：脱壳
echo ""
echo "[*] 步骤1：脱壳"
echo "-------------------------------------------"
if [ -d "dumped" ] && [ "$(ls -A dumped 2>/dev/null)" ]; then
    echo "[*] 发现已有脱壳文件，跳过脱壳步骤"
    echo "[*] 如需重新脱壳，请删除 dumped/ 目录"
else
    bash "$SCRIPT_DIR/unshell_and_pull.sh"
fi

# 步骤2：反编译
echo ""
echo "[*] 步骤2：反编译 Dex"
echo "-------------------------------------------"

if [ ! -d "dumped" ] || [ -z "$(ls -A dumped 2>/dev/null)" ]; then
    echo "[E] 没有找到脱壳文件!"
    echo "[*] 请先运行脱壳步骤"
    exit 1
fi

# 查找所有 dex 文件
DEX_FILES=$(find ./dumped -name "*.dex" -type f 2>/dev/null)
if [ -z "$DEX_FILES" ]; then
    echo "[E] 没有找到 Dex 文件!"
    exit 1
fi

echo "[*] 找到以下 Dex 文件:"
echo "$DEX_FILES"
echo ""

# 反编译每个 Dex
for dex in $DEX_FILES; do
    filename=$(basename "$dex" .dex)
    jarfile="./decompiled/${filename}.jar"

    echo "[*] 处理: $dex"

    if [ -f "$DEX2JAR" ]; then
        echo "[*] 转换为 Jar: $jarfile"
        bash "$DEX2JAR" "$dex" -o "$jarfile" 2>/dev/null || \
            echo "[!] 转换失败: $dex"
    else
        echo "[!] 跳过 (dex2jar 未安装)"
    fi
done

# 步骤3：生成项目结构
echo ""
echo "[*] 步骤3：整理输出"
echo "-------------------------------------------"

# 创建源码目录
mkdir -p ./project/source

# 如果有 Jar 文件，尝试提取
for jar in ./decompiled/*.jar; do
    if [ -f "$jar" ]; then
        echo "[*] 解压 Jar: $jar"
        mkdir -p "./project/$(basename $jar .jar)"
        unzip -q -o "$jar" -d "./project/$(basename $jar .jar)" 2>/dev/null || true
    fi
done

# 输出总结
echo ""
echo "=========================================="
echo "[*] 流水线完成!"
echo "=========================================="
echo "[*] 脱壳文件: $WORK_DIR/dumped/"
echo "[*] 反编译 Jar: $WORK_DIR/decompiled/"
echo "[*] 项目目录: $WORK_DIR/project/"
echo ""
echo "下一步:"
echo "  1. 使用 jadx-gui 打开 Jar 文件查看源码"
echo "  2. 或使用 IDE 导入 project/ 目录"
echo ""
echo "推荐工具:"
echo "  jadx-gui: https://github.com/skylot/jadx"
echo "  JD-GUI: https://jd-gui.github.io/"