/**
 * hook_webview_url_v2.js
 *
 * ClassLoader 枚举适配版：在所有能加载 WebView 相关类的 loader 上 hook URL 加载。
 * 覆盖 android.webkit.WebView、com.tencent.smtt.sdk.WebView(X5)、
 * flutter webview 插件常见入口，以及 shouldOverrideUrlLoading。
 *
 * 用法：frida -U -p <pid> -l hook_webview_url_v2.js
 * 日志：/data/local/tmp/webview_urls.log
 */

'use strict';

var KEYWORDS = ["h5game", "mwegame", "token=", "userId=", "accessToken", "act/"];

function shouldLog(url) {
    if (!url) return false;
    for (var i = 0; i < KEYWORDS.length; i++) {
        if (url.indexOf(KEYWORDS[i]) !== -1) return true;
    }
    return false;
}

function installWebViewHooks(factory, loaderTag) {
    var Java = factory;

    function appendLog(tag, url) {
        try {
            var File = Java.use("java.io.File");
            var FileWriter = Java.use("java.io.FileWriter");
            var fw = FileWriter.$new(File.$new("/data/local/tmp/webview_urls.log"), true);
            fw.write("[" + tag + "] " + url + "\n");
            fw.close();
        } catch (e) { /* ignore */ }
    }

    function handle(tag, url) {
        url = url ? url.toString() : "";
        if (shouldLog(url)) {
            console.log("[" + tag + "] " + url);
            appendLog(tag, url);
        }
    }

    var hooked = 0;

    ["android.webkit.WebView", "com.tencent.smtt.sdk.WebView"].forEach(function (cls) {
        var WV;
        try {
            WV = Java.use(cls);
        } catch (e) {
            return;
        }
        try {
            WV.loadUrl.overload("java.lang.String").implementation = function (url) {
                handle(cls + ".loadUrl", url);
                return this.loadUrl(url);
            };
            hooked++;
        } catch (e) { /* no overload */ }
        try {
            WV.loadUrl.overload("java.lang.String", "java.util.Map").implementation = function (url, headers) {
                handle(cls + ".loadUrl+", url);
                return this.loadUrl(url, headers);
            };
            hooked++;
        } catch (e) { /* no overload */ }
        try {
            WV.postUrl.overload("java.lang.String", "[B").implementation = function (url, data) {
                handle(cls + ".postUrl", url);
                return this.postUrl(url, data);
            };
            hooked++;
        } catch (e) { /* no overload */ }
    });

    // WebViewClient.shouldOverrideUrlLoading — 页面内跳转也能看到
    ["android.webkit.WebViewClient", "com.tencent.smtt.sdk.WebViewClient"].forEach(function (cls) {
        var C;
        try {
            C = Java.use(cls);
        } catch (e) {
            return;
        }
        try {
            C.shouldOverrideUrlLoading.overload("android.webkit.WebView", "java.lang.String").implementation = function (view, url) {
                handle(cls + ".shouldOverride", url);
                return this.shouldOverrideUrlLoading(view, url);
            };
            hooked++;
        } catch (e) { /* no overload */ }
    });

    if (hooked > 0) {
        console.log("[+] " + loaderTag + ": " + hooked + " hooks installed");
    }
    return hooked;
}

Java.perform(function () {
    console.log("[*] hook_webview_url_v2 开始");
    Java.enumerateClassLoaders({
        onMatch: function (loader) {
            try {
                var factory = Java.ClassFactory.get(loader);
                installWebViewHooks(factory, loader.getClass().getName());
            } catch (e) { /* skip */ }
        },
        onComplete: function () {
            console.log("[*] 完成");
        }
    });
});
