/**
 * hook_encrypt_layer_v4.js
 *
 * 捕获 api2.helper.qq.com 加密协议：TEA 密钥 + 明文请求 + 解密响应。
 * 适配乐固壳 + 启动时机：周期性枚举 ClassLoader，目标类出现后自动安装 hook，
 * spawn/attach 均可使用。
 *
 * 用法：
 *   抓启动登录：frida -U -f com.tencent.gamehelper.wuxia -l hook_encrypt_layer_v4.js --no-pause
 *   附加到运行中进程：frida -U -p <pid> -l hook_encrypt_layer_v4.js
 *
 * 产物（App 私有目录，root 后可读）：
 *   /data/data/com.tencent.gamehelper.wuxia/files/frida_capture/
 *     tea_key_N.bin / req_plain_N.bin / req_encrypted_N.bin / resp_plain_N.bin / meta.log
 */

'use strict';

var TARGET_CLASS = "com.tencent.gamehelper.netscene.base.d";
var CAPTURE_DIR = "/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/";
var installed = false;

function installHooks(factory, loaderTag) {
    if (installed) return;
    var Java = factory;
    var d;
    try {
        d = Java.use(TARGET_CLASS);
    } catch (e) {
        return;
    }
    installed = true;

    var counter = 0;

    function byteArrayToString(arr) {
        if (!arr) return "(null)";
        try {
            return Java.use("java.lang.String").$new(arr, "UTF-8");
        } catch (e) {
            return "(decode failed)";
        }
    }

    function saveBin(filename, bytes) {
        try {
            var File = Java.use("java.io.File");
            var FOS = Java.use("java.io.FileOutputStream");
            var dir = File.$new(CAPTURE_DIR);
            dir.mkdirs();
            var fos = FOS.$new(File.$new(CAPTURE_DIR + filename));
            fos.write(bytes);
            fos.close();
        } catch (e) {
            console.log("[SAVE FAILED] " + filename + ": " + e);
        }
    }

    function logMeta(text) {
        console.log(text);
        try {
            var File = Java.use("java.io.File");
            var FW = Java.use("java.io.FileWriter");
            var dir = File.$new(CAPTURE_DIR);
            dir.mkdirs();
            var fw = FW.$new(File.$new(CAPTURE_DIR + "meta.log"), true);
            fw.write(Java.use("java.lang.String").$new(text + "\n"));
            fw.close();
        } catch (e) { /* ignore */ }
    }

    // getTeaKey() 实例方法
    try {
        d.getTeaKey.overload().implementation = function () {
            var key = this.getTeaKey();
            logMeta("[TEA KEY #" + counter + "] len=" + (key ? key.length : 0));
            if (key) saveBin("tea_key_" + counter + ".bin", key);
            return key;
        };
    } catch (e) {
        console.log("[-] getTeaKey() hook failed: " + e);
    }

    // static getTeaKey(String) — 看密钥从什么字符串派生
    try {
        d.getTeaKey.overload("java.lang.String").implementation = function (s) {
            logMeta("[TEA KEY from string] input=" + s);
            return d.getTeaKey(s);
        };
    } catch (e) {
        console.log("[-] getTeaKey(String) hook failed: " + e);
    }

    d.buildOriginBody.implementation = function () {
        var body = this.buildOriginBody();
        counter++;
        logMeta("[REQ #" + counter + "] PLAIN " + (body ? body.length : 0) + " bytes");
        if (body) {
            saveBin("req_plain_" + counter + ".bin", body);
            var s = byteArrayToString(body);
            if (s && s.length < 800) logMeta("    str: " + s);
        }
        return body;
    };

    try {
        d.buildRequestDatas.overload().implementation = function () {
            var data = this.buildRequestDatas();
            logMeta("[REQ #" + counter + "] ENCRYPTED " + (data ? data.length : 0) + " bytes");
            if (data) saveBin("req_encrypted_" + counter + ".bin", data);
            return data;
        };
    } catch (e) {
        console.log("[-] buildRequestDatas hook failed: " + e);
    }

    d.transformResponseDatas.overload("java.util.Map", "[B").implementation = function (headers, responseBytes) {
        if (responseBytes) saveBin("resp_encrypted_" + counter + ".bin", responseBytes);
        var decrypted = this.transformResponseDatas(headers, responseBytes);
        logMeta("[RESP #" + counter + "] DECRYPTED " + (decrypted ? decrypted.length : 0) + " bytes");
        if (decrypted) {
            saveBin("resp_plain_" + counter + ".bin", decrypted);
            var s = byteArrayToString(decrypted);
            if (s && s.length < 800) logMeta("    str: " + s);
        }
        return decrypted;
    };

    try {
        var u1 = Java.use("com.tencent.gamehelper.netscene.u1");
        u1.getSceneCmd.implementation = function () {
            var cmd = this.getSceneCmd();
            logMeta("[CMD #" + counter + "] " + cmd);
            return cmd;
        };
    } catch (e) { /* ignore */ }

    try {
        var i2 = Java.use("com.tencent.gamehelper.netscene.base.i");
        i2.getUrl.implementation = function () {
            var url = this.getUrl();
            logMeta("[URL #" + counter + "] " + url);
            return url;
        };
    } catch (e) { /* ignore */ }

    console.log("[+] hooks installed (" + loaderTag + ")");
}

function tryInstall() {
    if (installed) return;
    Java.perform(function () {
        Java.enumerateClassLoaders({
            onMatch: function (loader) {
                if (installed) return;
                try {
                    loader.findClass(TARGET_CLASS);
                    var factory = Java.ClassFactory.get(loader);
                    installHooks(factory, loader.getClass().getName());
                } catch (e) { /* 此 loader 无目标类 */ }
            },
            onComplete: function () { }
        });
    });
}

console.log("[*] hook_encrypt_layer_v4 启动，等待目标类加载...");
tryInstall();
if (!installed) {
    var timer = setInterval(function () {
        tryInstall();
        if (installed) {
            clearInterval(timer);
            console.log("[*] 目标类已加载，hook 完成");
        }
    }, 1000);
}
