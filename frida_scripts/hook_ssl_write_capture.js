/**
 * hook_ssl_write_capture.js
 *
 * Hook NativeCrypto.ENGINE_SSL_write_direct / ENGINE_SSL_read_direct
 * （签名: (long ssl, NativeSsl, long address, int length, callbacks)），
 * 从原生地址读写 TLS 明文，抓取全部 conscrypt 流量。
 *
 * 产物：/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/ssl_dump.log
 */

'use strict';

var CAPTURE_FILE = "/data/data/com.tencent.gamehelper.wuxia/files/frida_capture/ssl_dump.log";

Java.perform(function () {
    console.log("[*] hook_ssl_write_capture(ENGINE) 启动");

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

    function hexFromAddr(addr, len) {
        try {
            var bytes = new NativePointer(addr).readByteArray(len);
            var u8 = new Uint8Array(bytes);
            var out = [];
            for (var i = 0; i < u8.length; i++) {
                out.push(("0" + u8[i].toString(16)).slice(-2));
            }
            return out.join("");
        } catch (e) {
            return "(read failed: " + e + ")";
        }
    }

    try {
        var NC = Java.use("com.android.org.conscrypt.NativeCrypto");

        NC.ENGINE_SSL_write_direct.implementation = function (ssl, sslHolder, addr, len, cb) {
            try {
                append("[W] " + hexFromAddr(addr.toString(), len));
            } catch (e) { /* ignore */ }
            return this.ENGINE_SSL_write_direct(ssl, sslHolder, addr, len, cb);
        };

        NC.ENGINE_SSL_read_direct.implementation = function (ssl, sslHolder, addr, len, cb) {
            var ret = this.ENGINE_SSL_read_direct(ssl, sslHolder, addr, len, cb);
            if (ret > 0) {
                try {
                    append("[R] " + hexFromAddr(addr.toString(), ret));
                } catch (e) { /* ignore */ }
            }
            return ret;
        };

        console.log("[+] ENGINE SSL hooks installed");
        append("=== hooks installed ===");
    } catch (e) {
        console.log("[-] hook failed: " + e);
    }
});
