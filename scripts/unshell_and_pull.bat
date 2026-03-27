@echo off
REM unshell_and_pull.bat - 脱壳并提取 Dex (Windows)
REM
REM 用法: unshell_and_pull.bat [TIMEOUT]

setlocal enabledelayedexpansion

set PACKAGE=com.tencent.gamehelper.wuxia
set REMOTE_DIR=/data/local/tmp/unshell
set LOCAL_DIR=dumped
set TIMEOUT=%1
if "%TIMEOUT%"=="" set TIMEOUT=60

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR..

echo ==========================================
echo UnShellX - 脱壳并提取 (Windows)
echo ==========================================
echo [*] 包名: %PACKAGE%
echo [*] 远程目录: %REMOTE_DIR%
echo [*] 本地目录: %LOCAL_DIR%
echo [*] 等待时间: %TIMEOUT%秒
echo ==========================================

REM 检查 adb
where adb >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [E] adb 未找到!
    exit /b 1
)

REM 检查 Frida
where frida >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [E] frida 未找到!
    exit /b 1
)

REM 检查设备
adb devices | findstr "device" >nul
if %ERRORLEVEL% neq 0 (
    echo [E] 没有检测到设备!
    exit /b 1
)
echo [*] 设备检测成功

REM 创建本地目录
if not exist "%LOCAL_DIR%" mkdir "%LOCAL_DIR%"

REM 清空远程目录
echo [*] 清空远程目录...
adb shell rm -rf "%REMOTE_DIR%" 2>nul
adb shell mkdir -p "%REMOTE_DIR%" 2>nul

REM 推送脚本
echo [*] 推送 Frida 脚本...
adb push "%PROJECT_DIR%\frida_scripts\unshell_dexdump.js" "%REMOTE_DIR%\"

REM 确认推送成功
adb shell ls -la "%REMOTE_DIR%\"

REM 启动 Frida 脱壳
echo [*] 启动 Frida 脱壳...
echo [*] 请在应用中进行操作，触发类加载...
echo [*] %TIMEOUT% 秒后自动提取...

REM 使用 start 命令启动 Frida（独立窗口）
start "Frida Unshell" frida -U -f %PACKAGE% -l "%REMOTE_DIR%\unshell_dexdump.js" --no-pause

REM 等待
echo [*] 等待 %TIMEOUT% 秒...
timeout /t %TIMEOUT% /nobreak >nul

REM 关闭窗口
taskkill /FI "WINDOWTITLE eq Frida Unshell*" /F >nul 2>&1

REM 提取文件
echo [*] 提取脱壳文件...
adb pull "%REMOTE_DIR%\" "%LOCAL_DIR%\" 2>nul

REM 显示结果
echo.
echo ==========================================
echo [*] 提取结果:
echo ==========================================
if exist "%LOCAL_DIR%\*" (
    dir /b "%LOCAL_DIR%\"
) else (
    echo [!] 没有文件被提取
)

echo.
echo [*] 完成!
echo [*] 本地目录: %CD%\%LOCAL_DIR%

endlocal