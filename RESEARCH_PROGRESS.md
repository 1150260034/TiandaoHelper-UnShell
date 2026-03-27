# UnShellX 研究进展记录

> 更新时间: 2026-03-27 23:55

## 环境状态

### 已安装工具

| 工具 | 路径 | 状态 |
|------|------|------|
| **jadx** | `tools/lib/jadx-1.5.1-all.jar` (122MB) | ✅ 已安装 |
| **apktool** | `tools/apktool.jar` (24MB) | ✅ 已安装 |
| **Java** | `C:\Program Files\Android\Android Studio\jbr` (Java 21) | ✅ 已安装 |
| **ADB** | `C:\Users\wangyiqi\AppData\Local\Android\Sdk\platform-tools\adb` | ✅ 已安装 |
| **Frida** | 系统 PATH | ✅ v17.8.3 |
| **frida-server** | x86_64 版本 (106MB) | ✅ 已下载并推送 |

### Android 模拟器

| 项目 | 状态 |
|------|------|
| **设备** | `emulator-5554` |
| **Android 版本** | 12 |
| **CPU 架构** | x86_64 |
| **ROOT 权限** | ✅ 已获取 |
| **已安装应用** | `com.tencent.gamehelper.wuxia` |

---

## Frida 脱壳状态

### 问题 1: 架构不匹配 (已解决)
- **问题**: 最初下载了 arm64 版本的 frida-server
- **错误**: `Segmentation fault`
- **解决**: 下载了 x86_64 版本的 frida-server

### 问题 2: Spawn 模式应用崩溃
- **问题**: 脚本使用 spawn 模式时应用崩溃
- **错误**: `TypeError: not a function` at `hookNative`
- **原因**: `Process.enumerateModules()` 回调 API 在新版 Frida 中有变化
- **修复**: 已修改为 `Process.enumerateModules()` 同步 API

### 问题 3: 应用崩溃 (stack overflow)
- **问题**: 脚本加载后应用崩溃
- **错误**: `SEGV_ACCERR` - 栈溢出
- **原因**: 可能是壳检测到调试行为

---

## 已完成的步骤

1. ✅ 环境检查
2. ✅ 安装 jadx, apktool
3. ✅ 下载正确版本的 frida-server (x86_64)
4. ✅ 推送 frida-server 到模拟器
5. ✅ 启动 frida-server
6. ✅ Frida 可以连接设备并看到进程
7. ✅ 修复 Frida 脱壳脚本 (hookNative 问题)
8. ✅ 手动提取已解密的 DEX 文件
9. ✅ DEX Header 修复 (fix_dex_headers.py)
10. ✅ 创建简化版 Frida 脱壳脚本 (unshell_simple.js)
11. ✅ DEX 文件反编译完成

### 反编译输出目录

| 目录 | 说明 |
|------|------|
| `decompiled/` | 主要反编译输出 |
| `decompiled_all/` | 完整反编译 |
| `decompiled_simple/` | 简化版 DEX 反编译 |
| `decompiled_small/` | 小型 DEX 反编译 |
| `dumped/` | 原始 dump 文件 |
| `dumped_fixed/` | 修复后的 DEX |
| `dumped_fixed_simple/` | 简化修复版 |
| `dumped_fixed_v3/` | v3 修复版 |

### DEX Header 修复脚本

| 脚本 | 说明 |
|------|------|
| `fix_dex_headers.py` | 原始修复脚本 |
| `fix_dex_v2.py` | v2 修复版 |
| `fix_dex_v3.py` | v3 修复版 |
| `fix_dex_simple.py` | 简化修复版 |

---

## 重大发现：手动 DEX 提取成功

### 发现
应用运行时在 `/data/data/com.tencent.gamehelper.wuxia/` 目录下有**已解密的 DEX 文件**！

### 提取的 DEX 文件
| 文件名 | 大小 |
|--------|------|
| 00O000ll111l_0.dex | 8.6M |
| 00O000ll111l_1.dex | 8.7M |
| 00O000ll111l_2.dex | 11M |
| 00O000ll111l_3.dex | 9.1M |
| 00O000ll111l_4.dex | 3.8M |
| **总计** | **~41MB** |

### 关键发现
- 文件头为标准 `dex.035` 格式，**无需解密即可反编译**
- 设备上还有加密的 `0OO00l111l1l` (18MB) 和 `libshellx-super.so` (336KB)
- DEX 文件位于 `./dumped/` 目录

### 提取命令
```bash
adb shell "find /data/data/com.tencent.gamehelper.wuxia/ -name '*.dex'"
adb pull /data/data/com.tencent.gamehelper.wuxia/app_flutter/com.tencent.gamehelper.wuxia/ ./dumped/
```

### 下一步
使用 jadx 反编译 `./dumped/` 中的 DEX 文件获取源码

---

## Frida 脚本问题分析

脚本 `unshell_dexdump.js` 在第 207 行调用 `hookNative()` 时出错：

```javascript
function hookNative() {
  // ...
  var android_dlopen_ext = Module.findExportByName("libdl.so", "android_dlopen_ext");
  // android_dlopen_ext 返回 null 或 undefined
  Interceptor.attach(android_dlopen_ext, {  // TypeError: not a function
    // ...
  });
}
```

---

## 下一步计划

### 方案 A: 修复现有脚本
1. 添加空值检查
2. 使用更稳定的脱壳点
3. 降低 Hook 密度避免检测

### 方案 B: 使用简化脱壳脚本
创建一个最小化的脱壳脚本，只 Hook 关键的 DexFile 加载

### 方案 C: 手动提取 DEX
直接从 `/data/data/com.tencent.gamehelper.wuxia/` 目录提取已解密的 DEX

---

## 备选方案: 不使用 Frida 脱壳

如果 Frida 脱壳失败，可以尝试：

1. **直接解压 assets/0OO00l111l1l**
   - 这是加密的 DEX 文件 (19MB)
   - 可能可以直接解密或使用已知工具解密

2. **使用现有 extracted_apk**
   - `lib/arm64-v8a/libapp.so` 已解压
   - 可以进行静态分析

3. **使用其他脱壳工具**
   - frida-unpack
   - drizzledump
   - Castle

---

## 快速启动命令

```bash
# 启动 frida-server (需要先获取 root)
adb shell "su -c /data/local/tmp/frida-server &"

# 等待几秒后运行脚本
frida -U -f com.tencent.gamehelper.wuxia -l frida_scripts/unshell_dexdump.js

# 检查脱壳目录
adb shell "ls -la /data/local/tmp/unshell/"

# 提取脱壳文件
adb pull /data/local/tmp/unshell/ ./dumped/
```
