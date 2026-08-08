/**
 * hook_webview_url.js
 *
 * Hook 天刀助手 WebView 加载的 URL，捕获 h5game / 活动页 URL 中注入的
 * userId / token / accessToken 等会话参数。
 *
 * 使用方法：
 *   1. frida-server 已在设备运行
 *   2. 先启动 App，再 attach：
 *      frida -U -n 天刀助手 -l hook_webview_url.js
 *      或按包名：frida -U -n com.tencent.gamehelper.wuxia -l hook_webview_url.js
 *   3. 在 App 里点开"全民礼包"等活动页，观察控制台输出
 *
 * 输出：匹配的 URL 打印到控制台并追加写入 /data/local/tmp/webview_urls.log
 */

'use strict';

Java.perform(function () {
    console.log("[*] Hook WebView.loadUrl - 开始");

    var KEYWORDS = ["h5game", "mwegame", "token=", "userId=", "accessToken"];

    function shouldLog(url) {
        if (!url) return false;
        for (var i = 0; i < KEYWORDS.length; i++) {
            if (url.indexOf(KEYWORDS[i]) !== -1) return true;
        }
        return false;
    }

    function appendLog(url) {
        try {
            var File = Java.use("java.io.File");
            var FileWriter = Java.use("java.io.FileWriter");
            var fw = FileWriter.$new(File.$new("/data/local/tmp/webview_urls.log"), true);
            fw.write(url + "\n");
            fw.close();
        } catch (e) {
            console.log("    [LOG FAILED] " + e);
        }
    }

    function handleUrl(url) {
        url = url ? url.toString() : "";
        if (shouldLog(url)) {
            console.log("\n[WEBVIEW URL] " + url);
            appendLog(url);
        }
    }

    try {
        var WebView = Java.use("android.webkit.WebView");

        try {
            WebView.loadUrl.overload("java.lang.String").implementation = function (url) {
                handleUrl(url);
                return this.loadUrl(url);
            };
        } catch (e) {
            console.log("[-] loadUrl(String) hook failed: " + e);
        }

        try {
            WebView.loadUrl.overload("java.lang.String", "java.util.Map").implementation = function (url, headers) {
                handleUrl(url);
                return this.loadUrl(url, headers);
            };
        } catch (e) {
            console.log("[-] loadUrl(String,Map) hook failed: " + e);
        }

        // X5 (腾讯浏览服务) WebView
        try {
            var X5WebView = Java.use("com.tencent.smtt.sdk.WebView");
            X5WebView.loadUrl.overload("java.lang.String").implementation = function (url) {
                handleUrl(url);
                return this.loadUrl(url);
            };
            try {
                X5WebView.loadUrl.overload("java.lang.String", "java.util.Map").implementation = function (url, headers) {
                    handleUrl(url);
                    return this.loadUrl(url, headers);
                };
            } catch (e) { /* 无此重载忽略 */ }
            console.log("[+] X5 WebView hooks installed");
        } catch (e) {
            console.log("[-] X5 WebView not used: " + e);
        }

        console.log("[+] WebView hooks installed, waiting for page loads...");
    } catch (e) {
        console.log("[-] WebView hook failed: " + e);
    }
});
