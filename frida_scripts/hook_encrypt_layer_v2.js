/**
 * hook_encrypt_layer_v2.js
 *
 * 修正版：按 3.10.0 实际签名 hook EncryptNetScene
 *   protected byte[] getTeaKey()
 *   public static String getTeaKey(String)
 *   protected byte[] buildOriginBody()
 *   public byte[] buildRequestDatas()      (另有 Object 桥接方法)
 *   protected ... transformResponseDatas(Map, byte[])
 *
 * 用法：frida -U -p <pid> -l hook_encrypt_layer_v2.js
 * 产物：/data/local/tmp/{tea_key,req_plain,req_encrypted,resp_plain}_N.bin
 */

'use strict';

Java.perform(function () {
    console.log("[*] hook_encrypt_layer_v2 开始");

    function hexDump(arr, limit) {
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

    var counter = 0;
    var d = Java.use("com.tencent.gamehelper.netscene.base.d");

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
        console.log(hexDump(body, 256));
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
        console.log(hexDump(decrypted, 384));
        var s = byteArrayToString(decrypted);
        if (s && s.length < 1500) console.log("    as string: " + s);
        if (decrypted) saveToFile("resp_plain_" + counter + ".bin", decrypted);
        return decrypted;
    };

    // 附带：sceneCmd / URL，便于把请求和接口对应起来
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

    console.log("[+] hooks installed");
});
