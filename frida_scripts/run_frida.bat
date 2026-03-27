@echo off
REM UnShellX - 快速启动 Frida 脱壳脚本 (Windows)

setlocal enabledelayedexpansion

REM 配置
set PACKAGE=com.tencent.gamehelper.wuxia
set SCRIPT_DIR=%~dp0
set ADB_PATH=C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools\adb.exe

echo ==========================================
echo UnShellX - 乐固壳脱壳工具
echo ==========================================

REM 检查 frida 是否安装
where frida >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [E] frida 未安装!
    echo 请运行: pip install frida-tools
    exit /b 1
)

REM 检查设备连接
echo [*] 检查设备连接...
%ADB_PATH% devices | findstr "device" >nul
if %ERRORLEVEL% neq 0 (
    echo [E] 没有检测到 USB 设备!
    echo 请确保:
    echo   1. 手机已通过 USB 连接
    echo   2. USB 调试已开启
    exit /b 1
)

echo [*] 设备已连接

REM 解析参数
set MODE=%1
if "%MODE%"=="" set MODE=spawn

if "%MODE%"=="spawn" (
    echo [*] 模式: Spawn ^(启动新进程^)
    echo [*] 包名: %PACKAGE%
    echo [*] 脚本: unshell_dexdump.js
    echo.
    echo 启动中...
    frida -U -f %PACKAGE% -l "%SCRIPT_DIR%unshell_dexdump.js"
) else if "%MODE%"=="attach" (
    echo [*] 模式: Attach ^(附加到已运行进程^)
    echo [*] 包名: %PACKAGE%
    echo [*] 脚本: unshell_dexdump.js
    echo.
    echo 附加中...
    frida -U %PACKAGE% -l "%SCRIPT_DIR%unshell_dexdump.js"
) else if "%MODE%"=="list" (
    echo [*] 列出已连接的设备上的应用
    frida-ps -U
) else (
    echo 用法: %~nx0 [spawn^|attach^|list]
    echo.
    echo   spawn  - 启动新进程并注入 ^(默认^)
    echo   attach - 附加到已运行的进程
    echo   list   - 列出已连接设备上的应用
    exit /b 1
)

endlocal