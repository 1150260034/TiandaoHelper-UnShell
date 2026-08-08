/**
 * hook_tls_capture.js
 *
 * Hook Conscrypt SSL 输入/输出流，抓取 TLS 明文（即完整 HTTP 请求/响应）。
 * 用于获取 api2.helper.qq.com 的线上密文，与 buildOriginBody 的明文配对分析。
 *
 * 用法：frida -U -p <pid> -l hook_tls_capture.js（App 已在运行）
 * 产物：/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/tls_dump.log
 *   格式：[WRITE #conn] hex… / [READ #conn] hex…
 */

'use strict';

var CAPTURE_FILE = "/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/tls_dump.log";
var installed = false;

function install(factory) {
    if (installed) return;
    var Java = factory;

    function append(text) {
        try {
            var File = Java.use("java.io.File");
            var FOS = Java.use("java.io.FileOutputStream");
            var JString = Java.use("java.lang.String");
            var dir = File.$new("/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/");
            dir.mkdirs();
            var fos = FOS.$new(File.$new(CAPTURE_FILE), true);
            fos.write(JString.$new(text + "\n").getBytes());
            fos.close();
        } catch (e) { /* ignore */ }
    }

    function toHex(arr, off, len) {
        var out = [];
        for (var i = off; i < off + len; i++) {
            out.push(("0" + (arr[i] & 0xff).toString(16)).slice(-2));
        }
        return out.join("");
    }

    var found = 0;
    Java.enumerateLoadedClasses({
        onMatch: function (name) {
            if (!/conscrypt/i.test(name)) return;
            if (!/SSLOutputStream|SSLInputStream/.test(name)) return;
            try {
                var cls = factory.use(name);
                if (/SSLOutputStream/.test(name)) {
                    cls.write.overload("[B", "int", "int").implementation = function (buf, off, len) {
                        try {
                            append("[WRITE " + this.hashCode() + "] " + toHex(buf, off, len));
                        } catch (e) { /* ignore */ }
                        return this.write(buf, off, len);
                    };
                    found++;
                } else {
                    cls.read.overload("[B", "int", "int").implementation = function (buf, off, len) {
                        var n = this.read(buf, off, len);
                        if (n > 0) {
                            try {
                                append("[READ " + this.hashCode() + "] " + toHex(buf, off, n));
                            } catch (e) { /* ignore */ }
                        }
                        return n;
                    };
                    found++;
                }
            } catch (e) { /* 类方法签名不符则跳过 */ }
        },
        onComplete: function () {
            console.log("[*] TLS capture hooks: " + found);
            append("=== hooks installed ===");
        }
    });
    installed = true;
}

Java.perform(function () {
    console.log("[*] hook_tls_capture 启动");
    install(Java);
});
