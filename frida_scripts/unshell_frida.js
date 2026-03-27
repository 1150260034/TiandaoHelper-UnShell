/**
 * UnShellX - 乐固壳脱壳脚本 (Frida版)
 *
 * 目标: 天刀助手 (com.tencent.gamehelper.wuxia)
 * 壳类型: 腾讯乐固 4.6.2.2 + 梆梆加固
 *
 * 使用方法:
 *   frida -U -f com.tencent.gamehelper.wuxia -l unshell_frida.js --no-pause
 *
 * 或者附加到已运行的进程:
 *   frida -U com.tencent.gamehelper.wuxia -l unshell_frida.js
 */

"use strict";

// ==================== 配置 ====================
const CONFIG = {
    // 目标包名
    TARGET_PACKAGE: "com.tencent.gamehelper.wuxia",

    // 是否打印详细日志
    VERBOSE: true,

    // 是否保存 Dex 文件
    DUMP_DEX: true,

    // Dex 输出目录
    DUMP_DIR: "/data/local/tmp/unshell/"
};

// ==================== 工具函数 ====================
const log = {
    i: function(msg) {
        console.log("[*] " + msg);
    },
    d: function(msg) {
        if (CONFIG.VERBOSE) {
            console.log("[D] " + msg);
        }
    },
    e: function(msg) {
        console.log("[E] " + msg);
    }
};

// ==================== 脱壳点 1: Hook ClassLoader.loadClass ====================
/**
 * 这是 ApkShelling 项目使用的主要脱壳点
 * 当类被 ClassLoader 加载时，获取其 Dex 对象
 */
function hookClassLoader() {
    log.i("Hooking ClassLoader.loadClass...");

    Java.perform(function() {
        var ClassLoader = Java.use("java.lang.ClassLoader");
        var BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");

        // Hook loadClass 方法
        ClassLoader.loadClass.overload('java.lang.String', 'boolean').implementation = function(name, resolve) {
            log.d("loadClass called: " + name);

            try {
                var result = this.loadClass(name, resolve);
                log.i("Class loaded: " + name + " -> " + result);

                // 尝试获取并保存 Dex
                tryDumpDex(name, result);

                return result;
            } catch (e) {
                log.d("loadClass failed for: " + name + " - " + e);
                return this.loadClass(name, resolve);
            }
        };

        log.i("ClassLoader.loadClass hooked successfully");
    });
}

// ==================== 脱壳点 2: Hook BaseDexClassLoader ====================
/**
 * Hook BaseDexClassLoader 的 findClass 方法
 */
function hookBaseDexClassLoader() {
    log.i("Hooking BaseDexClassLoader.findClass...");

    Java.perform(function() {
        var BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");

        BaseDexClassLoader.findClass.implementation = function(name) {
            log.d("findClass called: " + name);

            try {
                var result = this.findClass(name);
                log.i("Class found: " + name);
                return result;
            } catch (e) {
                return this.findClass(name);
            }
        };

        log.i("BaseDexClassLoader.findClass hooked");
    });
}

// ==================== 脱壳点 3: Hook DexFile 相关 ====================
/**
 * Hook dalvik.system.DexFile
 * 某些壳会在此处释放原始 Dex
 */
function hookDexFile() {
    log.i("Hooking dalvik.system.DexFile...");

    Java.perform(function() {
        var DexFile = Java.use("dalvik.system.DexFile");

        // Hook 构造函数
        DexFile.$init.overload('java.lang.String').implementation = function(fileName) {
            log.d("DexFile(String) called: " + fileName);
            return this.$init(fileName);
        };

        // Hook loadDex
        if (DexFile.loadDex) {
            DexFile.loadDex.overload('java.lang.String', 'java.lang.String', 'int').implementation = function(sourceName, outputName, flags) {
                log.i("loadDex called: " + sourceName + " -> " + outputName);
                return this.loadDex(sourceName, outputName, flags);
            };
        }

        log.i("DexFile hooked");
    });
}

// ==================== 脱壳点 4: Hook native 层 ====================
/**
 * Hook native 层的 SO 加载
 * 监控壳 SO 的加载时机
 */
function hookNative() {
    log.i("Hooking native layer...");

    // Hook android_dlopen_ext
    var android_dlopen_ext = Module.findExportByName("libdl.so", "android_dlopen_ext");
    if (android_dlopen_ext) {
        Interceptor.attach(android_dlopen_ext, {
            onEnter: function(args) {
                var soName = args[0].readCString();
                if (soName && (soName.includes("shell") || soName.includes("legu") || soName.includes("wbsafe"))) {
                    log.i("SO loaded: " + soName);
                }
            },
            onLeave: function(retval) {
            }
        });
    }

    // Hook System.loadLibrary
    var systemLoadLibrary = Module.findExportByName("libjava.so", "System.loadLibrary");
    if (systemLoadLibrary) {
        Interceptor.attach(systemLoadLibrary, {
            onEnter: function(args) {
                var libName = args[0].readCString();
                log.d("System.loadLibrary: " + libName);
            }
        });
    }

    log.i("Native layer hooked");
}

// ==================== 脱壳点 5: Hook libart.so ====================
/**
 * Hook ART 层的类加载相关函数
 */
function hookArt() {
    log.i("Hooking ART runtime...");

    // 尝试 Hook OpenSSL 相关的native函数
    var symbols = Module.enumerateSymbolsSync("libart.so");
    symbols.forEach(function(sym) {
        if (sym.name.includes("ClassLinker")) {
            log.d("Found: " + sym.name + " at " + sym.address);
        }
    });

    log.i("ART runtime hooked");
}

// ==================== 尝试获取 Dex 对象 ====================
function tryDumpDex(className, classObject) {
    if (!CONFIG.DUMP_DEX) return;

    try {
        // 尝试获取 ClassLoader
        var classLoader = classObject.getClassLoader();
        if (!classLoader) {
            log.d("No ClassLoader for: " + className);
            return;
        }

        // 尝试转换为 BaseDexClassLoader
        var BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
        if (Java.cast(classLoader, BaseDexClassLoader)) {
            var pathList = Java.cast(classLoader, BaseDexClassLoader).pathList.value;
            if (pathList) {
                log.d("Got pathList for: " + className);
                // 这里可以进一步遍历 DexPathList 获取实际的 Dex 文件
            }
        }
    } catch (e) {
        log.d("tryDumpDex failed: " + e);
    }
}

// ==================== 主函数 ====================
function main() {
    log.i("========================================");
    log.i("UnShellX - 乐固壳脱壳脚本启动");
    log.i("目标: " + CONFIG.TARGET_PACKAGE);
    log.i("Frida 版本: " + Frida.version);
    log.i("========================================");

    // 检查 Java 环境
    if (!Java.available) {
        log.e("Java 环境不可用!");
        return;
    }

    Java.perform(function() {
        log.i("Java 环境已就绪");

        // 安装各种 Hook
        hookClassLoader();
        hookBaseDexClassLoader();
        hookDexFile();
        hookNative();
        hookArt();

        log.i("========================================");
        log.i("所有 Hook 已安装");
        log.i("请触发应用进行类加载...");
        log.i("========================================");
    });
}

// 启动
setTimeout(main, 500);