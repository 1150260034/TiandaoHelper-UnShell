/**
 * hook_encrypt_layer_v3.js
 *
 * 加固壳适配版：枚举所有 ClassLoader，在真正加载目标类的 loader 上安装 hook。
 * 乐固/梆梆壳会把业务 dex 装进自定义 ClassLoader，默认 Java.use hook 不到实例。
 *
 * 用法：frida -U -p <pid> -l hook_encrypt_layer_v3.js
 * 产物：/data/local/tmp/{tea_key,req_plain,req_encrypted,resp_plain}_N.bin
 */

'use strict';

var TARGET_CLASS = "com.tencent.gamehelper.netscene.base.d";

function hexDump(Java, arr, limit) {
    if (!arr) return "(null)";
    limit = limit || 256;
    var lines = [];
    var len = Math.min(arr.length, limit);
    for (var offset = 0; offset < len; offset += 16) {
        var hex = [], asc = [];
        for (var j = 0; j < 16 && offset + j < len; j++) {
            var b = arr[offset + j] & 0xff;
            hex.push(("0" + b.toString(16)).slice(-2));
            asc.push(b >= 32 && b < 127 ? String.fromCharCode(b) : ".");
        }
        var hexStr = hex.join(" ");
        while (hexStr.length < 48) hexStr += " ";
        lines.push("    " + ("0000" + offset.toString(16)).slice(-4) + ": " + hexStr + " " + asc.join(""));
    }
    if (arr.length > limit) lines.push("    ... (" + arr.length + " bytes total)");
    return lines.join("\n");
}

function installHooks(factory) {
    var Java = factory;
    var d;
    try {
        d = Java.use(TARGET_CLASS);
    } catch (e) {
        return false;
    }

    var counter = 0;

    function byteArrayToString(arr) {
        if (!arr) return "(null)";
        try {
            return Java.use("java.lang.String").$new(arr, "UTF-8");
        } catch (e) {
            return "(decode failed)";
        }
    }

    function saveToFile(filename, bytes) {
        try {
            var File = Java.use("java.io.File");
            var FileOutputStream = Java.use("java.io.FileOutputStream");
            var fos = FileOutputStream.$new(File.$new("/data/local/tmp/" + filename));
            fos.write(bytes);
            fos.close();
            console.log("    [SAVED] " + filename + " (" + bytes.length + " bytes)");
        } catch (e) {
            console.log("    [SAVE FAILED] " + e);
        }
    }

    d.getTeaKey.overload().implementation = function () {
        var key = this.getTeaKey();
        console.log("\n[TEA KEY] len=" + (key ? key.length : 0) + " str=" + byteArrayToString(key));
        if (key) saveToFile("tea_key_" + counter + ".bin", key);
        return key;
    };

    d.buildOriginBody.implementation = function () {
        var body = this.buildOriginBody();
        counter++;
        console.log("\n[REQ #" + counter + "] PLAIN BODY " + (body ? body.length : 0) + " bytes");
        console.log(hexDump(Java, body, 256));
        var s = byteArrayToString(body);
        if (s && s.length < 1500) console.log("    as string: " + s);
        if (body) saveToFile("req_plain_" + counter + ".bin", body);
        return body;
    };

    try {
        d.buildRequestDatas.overload().implementation = function () {
            var data = this.buildRequestDatas();
            console.log("[REQ #" + counter + "] ENCRYPTED BODY " + (data ? data.length : 0) + " bytes");
            if (data) saveToFile("req_encrypted_" + counter + ".bin", data);
            return data;
        };
    } catch (e) {
        console.log("[-] buildRequestDatas hook failed: " + e);
    }

    d.transformResponseDatas.overload("java.util.Map", "[B").implementation = function (headers, responseBytes) {
        if (responseBytes) saveToFile("resp_encrypted_" + counter + ".bin", responseBytes);
        var decrypted = this.transformResponseDatas(headers, responseBytes);
        console.log("\n[RESP #" + counter + "] DECRYPTED " + (decrypted ? decrypted.length : 0) + " bytes");
        console.log(hexDump(Java, decrypted, 384));
        var s = byteArrayToString(decrypted);
        if (s && s.length < 1500) console.log("    as string: " + s);
        if (decrypted) saveToFile("resp_plain_" + counter + ".bin", decrypted);
        return decrypted;
    };

    try {
        var u1 = Java.use("com.tencent.gamehelper.netscene.u1");
        u1.getSceneCmd.implementation = function () {
            var cmd = this.getSceneCmd();
            console.log("[CMD] " + cmd);
            return cmd;
        };
    } catch (e) { /* ignore */ }

    try {
        var i2 = Java.use("com.tencent.gamehelper.netscene.base.i");
        i2.getUrl.implementation = function () {
            var url = this.getUrl();
            console.log("[URL] " + url);
            return url;
        };
    } catch (e) { /* ignore */ }

    console.log("[+] hooks installed on classloader: " + factory._classLoader);
    return true;
}

Java.perform(function () {
    console.log("[*] hook_encrypt_layer_v3 开始，枚举 ClassLoader");

    // 先确认默认 loader 是否真的能影响实例（打印一下）
    var installed = false;

    Java.enumerateClassLoaders({
        onMatch: function (loader) {
            try {
                var factory = Java.ClassFactory.get(loader);
                factory._classLoader = loader;
                // 试探该类是否由此 loader 加载
                loader.findClass(TARGET_CLASS);
                console.log("[*] loader 可加载目标类: " + loader.toString());
                if (installHooks(factory)) {
                    installed = true;
                }
            } catch (e) {
                // 此 loader 没有目标类，跳过
            }
        },
        onComplete: function () {
            console.log("[*] ClassLoader 枚举完成, installed=" + installed);
        }
    });
});
