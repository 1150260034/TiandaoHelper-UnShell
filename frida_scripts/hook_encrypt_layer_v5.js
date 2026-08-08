/**
 * hook_encrypt_layer_v5.js
 *
 * 修正 v4 的问题：
 * - meta.log 改用 FileOutputStream 写字节（v4 的 FileWriter.write 静默失败）
 * - 记录 transformResponseDatas 的 headers（Content-Type 判断密文/错误页）
 * - 记录 buildRequestDatas 返回值的实际长度和首字节
 *
 * 用法：frida -U -f com.tencent.gamehelper.wuxia -l hook_encrypt_layer_v5.js --eternalize -q
 * 产物：/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/
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

    function writeBytes(filename, bytes, append) {
        try {
            var File = Java.use("java.io.File");
            var FOS = Java.use("java.io.FileOutputStream");
            var dir = File.$new(CAPTURE_DIR);
            dir.mkdirs();
            var fos = FOS.$new(File.$new(CAPTURE_DIR + filename), append === true);
            fos.write(bytes);
            fos.close();
        } catch (e) { /* ignore */ }
    }

    function logMeta(text) {
        try {
            var JString = Java.use("java.lang.String");
            writeBytes("meta.log", JString.$new(text + "\n").getBytes(), true);
        } catch (e) { /* ignore */ }
    }

    function byteArrayToString(arr) {
        if (!arr) return "(null)";
        try {
            return Java.use("java.lang.String").$new(arr, "UTF-8");
        } catch (e) {
            return "(decode failed)";
        }
    }

    function headHex(arr, n) {
        if (!arr) return "(null)";
        var out = [];
        for (var i = 0; i < Math.min(arr.length, n || 16); i++) {
            out.push(("0" + (arr[i] & 0xff).toString(16)).slice(-2));
        }
        return out.join("");
    }

    try {
        d.getTeaKey.overload().implementation = function () {
            var key = this.getTeaKey();
            logMeta("[TEA KEY #" + counter + "] len=" + (key ? key.length : 0) + " hex=" + headHex(key, 16));
            if (key) writeBytes("tea_key_" + counter + ".bin", key);
            return key;
        };
    } catch (e) {
        logMeta("[-] getTeaKey() hook failed: " + e);
    }

    try {
        d.getTeaKey.overload("java.lang.String").implementation = function (s) {
            var key = d.getTeaKey(s);
            logMeta("[TEA KEY static] input=" + s + " -> " + key);
            return key;
        };
    } catch (e) {
        logMeta("[-] getTeaKey(String) hook failed: " + e);
    }

    d.buildOriginBody.implementation = function () {
        var body = this.buildOriginBody();
        counter++;
        logMeta("[REQ #" + counter + "] PLAIN " + (body ? body.length : 0) + "B head=" + headHex(body, 12));
        if (body) writeBytes("req_plain_" + counter + ".bin", body);
        return body;
    };

    // buildRequestDatas 有 Object 桥接和 byte[] 两个同签名方法，都 hook
    try {
        var methods = d.class.getDeclaredMethods();
        for (var mi = 0; mi < methods.length; mi++) {
            var m = methods[mi];
            if (m.getName() !== "buildRequestDatas") continue;
            var retType = m.getReturnType().getName();
            (function (retT) {
                d.buildRequestDatas.overload().implementation = function () {
                    var data = this.buildRequestDatas();
                    logMeta("[REQ #" + counter + "] ENCRYPTED(" + retT + ") " +
                            (data && data.length !== undefined ? data.length : "?") +
                            "B head=" + (data && data.length ? headHex(data, 12) : "?"));
                    if (data && data.length) writeBytes("req_encrypted_" + counter + ".bin", data);
                    return data;
                };
            })(retType);
        }
    } catch (e) {
        logMeta("[-] buildRequestDatas hook failed: " + e);
    }

    d.transformResponseDatas.overload("java.util.Map", "[B").implementation = function (headers, responseBytes) {
        var ct = "?";
        try {
            var H = headers;
            ct = "" + H.get("Content-Type");
        } catch (e) { /* ignore */ }
        logMeta("[RESP #" + counter + "] ENCRYPTED " + (responseBytes ? responseBytes.length : 0) +
                "B ct=" + ct + " head=" + headHex(responseBytes, 12));
        if (responseBytes && responseBytes.length) writeBytes("resp_encrypted_" + counter + ".bin", responseBytes);
        var decrypted = this.transformResponseDatas(headers, responseBytes);
        logMeta("[RESP #" + counter + "] DECRYPTED " + (decrypted ? decrypted.length : 0) + "B");
        if (decrypted && decrypted.length) {
            writeBytes("resp_plain_" + counter + ".bin", decrypted);
            var s = byteArrayToString(decrypted);
            if (s && s.length < 500) logMeta("    str: " + s);
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

    console.log("[+] v5 hooks installed (" + loaderTag + ")");
}

function tryInstall() {
    if (installed) return;
    Java.perform(function () {
        Java.enumerateClassLoaders({
            onMatch: function (loader) {
                if (installed) return;
                try {
                    loader.findClass(TARGET_CLASS);
                    installHooks(Java.ClassFactory.get(loader), loader.getClass().getName());
                } catch (e) { /* skip */ }
            },
            onComplete: function () { }
        });
    });
}

console.log("[*] hook_encrypt_layer_v5 启动...");
tryInstall();
if (!installed) {
    var timer = setInterval(function () {
        tryInstall();
        if (installed) {
            clearInterval(timer);
            console.log("[*] hook 完成");
        }
    }, 1000);
}
