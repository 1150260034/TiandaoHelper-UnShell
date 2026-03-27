/**
 * UnShellX - 乐固壳高级脱壳脚本 v2
 *
 * 增强版: 包含多个脱壳点和 Dex 提取逻辑
 *
 * 使用方法:
 *   frida -U -f com.tencent.gamehelper.wuxia -l unshell_dexdump.js --no-pause
 */

"use strict";

// ==================== 配置 ====================
const CONFIG = {
    TARGET_PACKAGE: "com.tencent.gamehelper.wuxia",
    VERBOSE: true,
    DUMP_DEX: true,
    DUMP_DIR: "/data/local/tmp/unshell/",

    // 等待应用启动的超时时间(ms)
    WAIT_TIMEOUT: 30000,

    // 最大保存的 Dex 数量
    MAX_DEX_DUMP: 100,

    // 记录已处理的类
    processedClasses: new Set()
};

const log = {
    i: function(msg) { console.log("[*] " + msg); },
    d: function(msg) { if (CONFIG.VERBOSE) console.log("[D] " + msg); },
    e: function(msg) { console.log("[E] " + msg); }
};

// ==================== 脱壳点 1: Hook 所有 ClassLoader 实现 ====================
function hookAllClassLoaders() {
    log.i("Hooking all ClassLoader implementations...");

    Java.perform(function() {
        // 1.1 java.lang.ClassLoader
        var ClassLoader = Java.use("java.lang.ClassLoader");

        ClassLoader.loadClass.overload('java.lang.String').implementation = function(name) {
            return hookClassLoad(this, name, false);
        };

        ClassLoader.loadClass.overload('java.lang.String', 'boolean').implementation = function(name, resolve) {
            return hookClassLoad(this, name, resolve);
        };

        // 1.2 dalvik.system.BaseDexClassLoader
        try {
            var BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
            BaseDexClassLoader.findClass.overload('java.lang.String').implementation = function(name) {
                return hookBaseDexFindClass(this, name);
            };
            log.i("BaseDexClassLoader.findClass hooked");
        } catch (e) {
            log.e("Failed to hook BaseDexClassLoader: " + e);
        }

        // 1.3 dalvik.system.DexClassLoader
        try {
            var DexClassLoader = Java.use("dalvik.system.DexClassLoader");
            DexClassLoader.findClass.implementation = function(name) {
                return hookBaseDexFindClass(this, name);
            };
            log.i("DexClassLoader.findClass hooked");
        } catch (e) {
            log.e("Failed to hook DexClassLoader: " + e);
        }

        log.i("All ClassLoaders hooked");
    });
}

function hookClassLoad(loader, className, resolve) {
    var result = null;
    try {
        if (resolve === false) {
            result = loader.loadClass(className);
        } else {
            result = loader.loadClass(className, resolve);
        }
        onClassLoaded(className, result, loader);
        return result;
    } catch (e) {
        return result;
    }
}

function hookBaseDexFindClass(loader, className) {
    var result = null;
    try {
        result = loader.findClass(className);
        onClassLoaded(className, result, loader);
        return result;
    } catch (e) {
        return result;
    }
}

// ==================== 脱壳点 2: Hook PathClassLoader 和 ContextClassLoader ====================
function hookContextClassLoader() {
    Java.perform(function() {
        // Hook Thread.contextClassLoader
        var Thread = Java.use("java.lang.Thread");
        var contextClassLoaderField = Thread.class.getDeclaredField("contextClassLoader");
        contextClassLoaderField.setAccessible(true);

        // 定期检查当前线程的 ClassLoader
        setInterval(function() {
            try {
                var currentThread = Thread.currentThread();
                var cl = contextClassLoaderField.get(currentThread);
                if (cl) {
                    inspectClassLoader(cl);
                }
            } catch (e) {
                // 忽略
            }
        }, 1000);
    });
}

// ==================== 脱壳点 3: Hook DexFile ====================
function hookDexFile() {
    log.i("Hooking dalvik.system.DexFile...");

    Java.perform(function() {
        var DexFile = Java.use("dalvik.system.DexFile");

        // Hook 构造函数
        DexFile.$init.overload('java.lang.String').implementation = function(fileName) {
            log.d("DexFile(String) init: " + fileName);
            return this.$init(fileName);
        };

        DexFile.$init.overload('java.io.File').implementation = function(file) {
            log.d("DexFile(File) init: " + file.toString());
            return this.$init(file);
        };

        // Hook loadDex
        try {
            if (DexFile.loadDex) {
                DexFile.loadDex.overload('java.lang.String', 'java.lang.String', 'int').implementation = function(srcName, outName, flags) {
                    log.i("DexFile.loadDex: " + srcName + " -> " + outName);
                    return this.loadDex(srcName, outName, flags);
                };
            }
        } catch (e) {
            log.d("loadDex hook skipped: " + e);
        }

        // Hook defineClass (某些壳会在这里释放 Dex)
        try {
            if (DexFile.defineClass) {
                DexFile.defineClass.overload('java.lang.String', 'java.lang.ClassLoader', '[B', 'int', 'int', 'java.security.ProtectionDomain').implementation = function(name, loader, buf, offset, len, pd) {
                    log.i("DexFile.defineClass: " + name);
                    return this.defineClass(name, loader, buf, offset, len, pd);
                };
            }
        } catch (e) {
            log.d("defineClass hook skipped: " + e);
        }

        log.i("DexFile hooked");
    });
}

// ==================== 脱壳点 4: Hook native 层 SO 加载 ====================
var shellSoCallbacks = {};

function hookNative() {
    log.i("Hooking native layer...");

    // 4.1 Hook android_dlopen_ext
    var android_dlopen_ext = Module.findExportByName("libdl.so", "android_dlopen_ext");
    if (android_dlopen_ext) {
        Interceptor.attach(android_dlopen_ext, {
            onEnter: function(args) {
                var soName = args[0].readCString();
                this.soName = soName;
                if (soName) {
                    log.i("[Native] dlopen: " + soName);
                    if (isShellSo(soName)) {
                        log.i("[Native] Shell SO detected: " + soName);
                        shellSoCallbacks[soName] = true;
                    }
                }
            },
            onLeave: function(retval) {
            }
        });
    }

    // 4.2 Hook __android_dlopen_ext (alternative)
    try {
        var android_dlopen_ext_alt = Module.findExportByName("libdl.so", "__android_dlopen_ext");
        if (android_dlopen_ext_alt) {
            Interceptor.attach(android_dlopen_ext_alt, {
                onEnter: function(args) {
                    var soName = args[0].readCString();
                    if (soName && isShellSo(soName)) {
                        log.i("[Native] __android_dlopen_ext: " + soName);
                    }
                }
            });
        }
    } catch (e) {
        log.d("__android_dlopen_ext hook skipped");
    }

    // 4.3 Hook JNI_OnLoad
    hookJNIOnLoad();

    log.i("Native layer hooked");
}

function isShellSo(soName) {
    if (!soName) return false;
    var shellPatterns = [
        "shell", "legu", "wbsafe", "bangbang",
        "libshell-super", "libshella", "libwbsafeedit"
    ];
    for (var i = 0; i < shellPatterns.length; i++) {
        if (soName.toLowerCase().includes(shellPatterns[i])) {
            return true;
        }
    }
    return false;
}

// ==================== 脱壳点 5: Hook JNI_OnLoad ====================
function hookJNIOnLoad() {
    var libdl = Module.findBaseAddress("libdl.so");
    if (libdl) {
        log.d("libdl.so base: " + libdl);
    }

    // 遍历已加载的模块，查找壳 SO
    Process.enumerateModules({
        onMatch: function(module) {
            if (isShellSo(module.name)) {
                log.i("[Module] Found shell SO: " + module.name + " @ " + module.base);
                tryHookJNIOnLoad(module);
            }
        },
        onComplete: function() {
        }
    });
}

function tryHookJNIOnLoad(module) {
    try {
        var exports = module.enumerateExports();
        exports.forEach(function(exp) {
            if (exp.name === "JNI_OnLoad") {
                log.i("[JNI] JNI_OnLoad found in " + module.name + " at " + exp.address);
                Interceptor.attach(exp.address, {
                    onEnter: function(args) {
                        log.i("[JNI] JNI_OnLoad called from " + module.name);
                        this.vm = args[0];
                        this.version = args[1];
                    },
                    onLeave: function(retval) {
                        log.i("[JNI] JNI_OnLoad returned: " + retval);
                    }
                });
            }
        });
    } catch (e) {
        log.e("Failed to hook JNI_OnLoad: " + e);
    }
}

// ==================== 类加载回调 ====================
function onClassLoaded(className, classObject, classLoader) {
    if (!className || CONFIG.processedClasses.has(className)) {
        return;
    }
    CONFIG.processedClasses.add(className);

    // 跳过已经处理过的类
    if (className.startsWith("java.") || className.startsWith("javax.") ||
        className.startsWith("android.") || className.startsWith("dalvik.") ||
        className.startsWith("kotlin.")) {
        return;
    }

    log.i("[Class] Loaded: " + className);

    // 尝试提取 Dex
    tryExtractDex(className, classLoader);
}

// ==================== Dex 提取逻辑 ====================
function tryExtractDex(className, classLoader) {
    if (!CONFIG.DUMP_DEX) return;

    try {
        var BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
        var castedLoader = Java.cast(classLoader, BaseDexClassLoader);

        // 获取 pathList
        var pathList = castedLoader.pathList.value;
        if (!pathList) return;

        var dexElements = pathList.getDeclaredField("dexElements");
        if (!dexElements) return;
        dexElements.setAccessible(true);
        var elements = dexElements.get(pathList);

        if (elements && elements.length > 0) {
            log.d("[Dex] Found " + elements.length + " dex elements for " + className);

            // 遍历 Dex 元素
            for (var i = 0; i < elements.length; i++) {
                var element = elements[i];
                var dexFile = element.getDeclaredField("dexFile");
                if (dexFile) {
                    dexFile.setAccessible(true);
                    var dex = dexFile.get(element);
                    if (dex) {
                        log.d("[Dex] Element " + i + " has dexFile");
                        tryDumpDexFile(dex, className + "_" + i);
                    }
                }
            }
        }
    } catch (e) {
        log.d("tryExtractDex failed: " + e);
    }
}

function tryDumpDexFile(dexFile, tag) {
    try {
        // 尝试获取 mFileName 或 cookie
        var cookie = dexFile.getDeclaredField("mCookie");
        if (cookie) {
            cookie.setAccessible(true);
            log.i("[Dex] mCookie: " + cookie.get(dexFile));
        }
    } catch (e) {
        log.d("tryDumpDexFile failed: " + e);
    }
}

// ==================== 遍历 ClassLoader 的所有类 ====================
function dumpAllClasses() {
    Java.perform(function() {
        var baseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
        var pathClassLoader = Java.use("dalvik.system.PathClassLoader");
        var currentLoader = Java.cast(Java.cast(Java.use("android.app.ActivityThread")
            .currentApplication().getClass().getClassLoader(),
            baseDexClassLoader), baseDexClassLoader);

        log.i("Current ClassLoader: " + currentLoader);

        // 遍历所有已加载的类
        var loadedClasses = Java.enumerateLoadedClasses({
            onMatch: function(className, handle) {
                if (!className.startsWith("java.") && !className.startsWith("android.")) {
                    log.i("[Loaded] " + className);
                }
            },
            onComplete: function() {
                log.i("Class enumeration complete");
            }
        });
    });
}

// ==================== 辅助函数 ====================
function inspectClassLoader(classLoader) {
    if (!classLoader) return;

    try {
        var BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
        if (Java.cast(classLoader, BaseDexClassLoader)) {
            var pathList = Java.cast(classLoader, BaseDexClassLoader).pathList.value;
            if (pathList) {
                // 进一步分析
            }
        }
    } catch (e) {
    }
}

// ==================== 主函数 ====================
function main() {
    log.i("==========================================");
    log.i("UnShellX - 乐固壳脱壳脚本 v2");
    log.i("目标: " + CONFIG.TARGET_PACKAGE);
    log.i("==========================================");

    if (!Java.available) {
        log.e("Java 环境不可用!");
        return;
    }

    Java.perform(function() {
        log.i("Java 环境已就绪");

        // 安装 Hook
        hookAllClassLoaders();
        hookDexFile();
        hookNative();

        // 等待并获取已加载的类
        setTimeout(function() {
            log.i("开始遍历已加载的类...");
            dumpAllClasses();
        }, 2000);

        log.i("==========================================");
        log.i("Hook 已安装，请操作应用触发类加载");
        log.i("已处理的类数量: " + CONFIG.processedClasses.size);
        log.i("==========================================");
    });
}

// 启动
setTimeout(main, 500);