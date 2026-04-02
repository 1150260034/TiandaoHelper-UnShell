/**
 * hook_encrypt_layer.js
 * 
 * Frida 脚本：Hook 天刀助手 EncryptNetScene 加密层
 * 目标：捕获 TEA 密钥 + 加密前明文请求 + 解密后响应
 * 
 * 使用方法：
 *   1. 确保 frida-server 已在模拟器上运行
 *   2. frida -U -f com.tencent.gamehelper.wuxia -l hook_encrypt_layer.js --no-pause
 *   3. 在 App 中操作（发消息/切换角色等），观察控制台输出
 * 
 * Hook 目标类（反编译对应关系）：
 *   com.tencent.gamehelper.netscene.base.d (EncryptNetScene)
 *     - getTeaKey()       → TEA 密钥
 *     - buildOriginBody() → 加密前请求体
 *     - buildRequestDatas2() → 加密后请求体
 *     - transformResponseDatas() → 解密后响应
 *   com.tencent.gamehelper.netscene.u1 (DeprecatedNetScene)
 *     - getSceneCmd()     → API 命令名 (如 "sendmessage", "switchrole")
 *   com.tencent.gamehelper.netscene.base.i (ProtocolRequest)
 *     - getUrl()          → 请求 URL
 *     - getCmd()          → 命令名
 */

'use strict';

Java.perform(function () {
    console.log("[*] Hook 天刀助手加密层 - 开始");

    // =============================================
    // 工具函数
    // =============================================
    function byteArrayToHex(arr) {
        if (!arr) return "(null)";
        var result = [];
        for (var i = 0; i < Math.min(arr.length, 512); i++) {
            var b = arr[i] & 0xff;
            result.push(("0" + b.toString(16)).slice(-2));
        }
        if (arr.length > 512) {
            result.push("... (truncated, total " + arr.length + " bytes)");
        }
        return result.join(" ");
    }

    function byteArrayToString(arr) {
        if (!arr) return "(null)";
        try {
            var StringClass = Java.use("java.lang.String");
            return StringClass.$new(arr, "UTF-8");
        } catch (e) {
            return "(decode failed: " + e + ")";
        }
    }

    function hexDump(arr, limit) {
        if (!arr) return "(null)";
        limit = limit || 256;
        var lines = [];
        var len = Math.min(arr.length, limit);
        for (var offset = 0; offset < len; offset += 16) {
            var hex = [];
            var asc = [];
            for (var j = 0; j < 16 && offset + j < len; j++) {
                var b = arr[offset + j] & 0xff;
                hex.push(("0" + b.toString(16)).slice(-2));
                asc.push(b >= 32 && b < 127 ? String.fromCharCode(b) : ".");
            }
            var hexStr = hex.join(" ");
            while (hexStr.length < 48) hexStr += " ";
            lines.push("    " + ("0000" + offset.toString(16)).slice(-4) + ": " + hexStr + " " + asc.join(""));
        }
        if (arr.length > limit) {
            lines.push("    ... (" + arr.length + " bytes total)");
        }
        return lines.join("\n");
    }

    function saveToFile(filename, bytes) {
        try {
            var File = Java.use("java.io.File");
            var FileOutputStream = Java.use("java.io.FileOutputStream");
            var outFile = File.$new("/data/local/tmp/" + filename);
            var fos = FileOutputStream.$new(outFile);
            fos.write(bytes);
            fos.close();
            console.log("    [SAVED] /data/local/tmp/" + filename + " (" + bytes.length + " bytes)");
        } catch (e) {
            console.log("    [SAVE FAILED] " + e);
        }
    }

    var requestCounter = 0;

    // =============================================
    // 1. Hook EncryptNetScene (com.tencent.gamehelper.netscene.base.d)
    // =============================================
    try {
        var EncryptNetScene = Java.use("com.tencent.gamehelper.netscene.base.d");
        console.log("[+] Found EncryptNetScene");

        // Hook getTeaKey() - 获取 TEA 密钥
        EncryptNetScene.getTeaKey.overload().implementation = function () {
            var key = this.getTeaKey();
            console.log("\n[TEA KEY] " + (key ? byteArrayToHex(key) : "(null bytes)"));
            if (key) {
                console.log("    key string: " + byteArrayToString(key));
                saveToFile("tea_key_" + requestCounter + ".bin", key);
            }
            return key;
        };

        // Hook static getTeaKey(String) - 从字符串生成 TEA 密钥
        try {
            EncryptNetScene.getTeaKey.overload("java.lang.String").implementation = function (str) {
                var key = this.getTeaKey(str);
                console.log("\n[TEA KEY from string]");
                console.log("    input: " + str);
                console.log("    output: " + key);
                return key;
            };
        } catch (e) {
            console.log("[-] getTeaKey(String) overload not found: " + e);
        }

        // Hook buildOriginBody() - 加密前的原始请求体
        EncryptNetScene.buildOriginBody.implementation = function () {
            var body = this.buildOriginBody();
            requestCounter++;
            console.log("\n" + "=".repeat(60));
            console.log("[REQUEST #" + requestCounter + "] PLAINTEXT BODY (before TEA encrypt)");
            console.log("=".repeat(60));
            if (body) {
                console.log("    size: " + body.length + " bytes");
                console.log(hexDump(body, 512));
                // 尝试解析为字符串
                var bodyStr = byteArrayToString(body);
                if (bodyStr && bodyStr.length < 2000) {
                    console.log("    as string: " + bodyStr);
                }
                saveToFile("req_plain_" + requestCounter + ".bin", body);
            }
            return body;
        };

        // Hook buildRequestDatas2() - 加密后的最终请求体
        EncryptNetScene.buildRequestDatas2.implementation = function () {
            var data = this.buildRequestDatas2();
            console.log("[REQUEST #" + requestCounter + "] ENCRYPTED BODY (after TEA encrypt)");
            if (data) {
                console.log("    size: " + data.length + " bytes");
                console.log(hexDump(data, 128));
                saveToFile("req_encrypted_" + requestCounter + ".bin", data);
            }
            return data;
        };

        // Hook transformResponseDatas() - 解密后的响应体
        EncryptNetScene.transformResponseDatas.overload("java.util.Map", "[B").implementation = function (headers, responseBytes) {
            console.log("\n[RESPONSE #" + requestCounter + "] ENCRYPTED RESPONSE");
            if (responseBytes) {
                console.log("    encrypted size: " + responseBytes.length + " bytes");
                console.log(hexDump(responseBytes, 128));
                saveToFile("resp_encrypted_" + requestCounter + ".bin", responseBytes);
            }

            var decrypted = this.transformResponseDatas(headers, responseBytes);

            console.log("[RESPONSE #" + requestCounter + "] DECRYPTED RESPONSE");
            if (decrypted) {
                console.log("    decrypted size: " + decrypted.length + " bytes");
                console.log(hexDump(decrypted, 512));
                var respStr = byteArrayToString(decrypted);
                if (respStr && respStr.length < 2000) {
                    console.log("    as string: " + respStr);
                }
                saveToFile("resp_plain_" + requestCounter + ".bin", decrypted);
            }
            return decrypted;
        };

        console.log("[+] EncryptNetScene hooks installed");
    } catch (e) {
        console.log("[-] EncryptNetScene hook failed: " + e);
    }

    // =============================================
    // 2. Hook DeprecatedNetScene (com.tencent.gamehelper.netscene.u1)
    // =============================================
    try {
        var DeprecatedNetScene = Java.use("com.tencent.gamehelper.netscene.u1");
        console.log("[+] Found DeprecatedNetScene");

        // Hook getSceneCmd() - 获取 API 命令名
        DeprecatedNetScene.getSceneCmd.implementation = function () {
            var cmd = this.getSceneCmd();
            console.log("[CMD] SceneCmd = " + cmd);
            return cmd;
        };
    } catch (e) {
        console.log("[-] DeprecatedNetScene hook failed: " + e);
    }

    // =============================================
    // 3. Hook ProtocolRequest (com.tencent.gamehelper.netscene.base.i)  
    // =============================================
    try {
        var ProtocolRequest = Java.use("com.tencent.gamehelper.netscene.base.i");
        console.log("[+] Found ProtocolRequest");

        // Hook getUrl() - 获取请求 URL
        ProtocolRequest.getUrl.implementation = function () {
            var url = this.getUrl();
            console.log("[URL] " + url);
            return url;
        };

        // Hook getCmd() - 获取命令
        ProtocolRequest.getCmd.implementation = function () {
            var cmd = this.getCmd();
            if (cmd) {
                console.log("[CMD] ProtocolRequest.cmd = " + cmd);
            }
            return cmd;
        };
    } catch (e) {
        console.log("[-] ProtocolRequest hook failed: " + e);
    }

    // =============================================
    // 4. Hook ReportSwitchRoleScene (com.tencent.gamehelper.netscene.e9)
    // =============================================
    try {
        var SwitchRoleScene = Java.use("com.tencent.gamehelper.netscene.e9");
        console.log("[+] Found ReportSwitchRoleScene");

        SwitchRoleScene.getRequestParams.implementation = function () {
            var params = this.getRequestParams();
            console.log("\n[SWITCHROLE] getRequestParams:");
            if (params) {
                console.log("    params: " + params.toString());
            }
            return params;
        };

        SwitchRoleScene.getSceneCmd.implementation = function () {
            var cmd = this.getSceneCmd();
            console.log("[SWITCHROLE] SceneCmd = " + cmd);
            return cmd;
        };
    } catch (e) {
        console.log("[-] ReportSwitchRoleScene hook failed: " + e);
    }

    // =============================================
    // 5. Hook ChatRolesScene (com.tencent.gamehelper.netscene.f0)
    // =============================================
    try {
        var ChatRolesScene = Java.use("com.tencent.gamehelper.netscene.f0");
        console.log("[+] Found ChatRolesScene");

        ChatRolesScene.getRequestParams.implementation = function () {
            var params = this.getRequestParams();
            console.log("\n[CHATROLES] getRequestParams:");
            if (params) {
                console.log("    params: " + params.toString());
            }
            return params;
        };

        ChatRolesScene.getSceneCmd.implementation = function () {
            var cmd = this.getSceneCmd();
            console.log("[CHATROLES] SceneCmd = " + cmd);
            return cmd;
        };
    } catch (e) {
        console.log("[-] ChatRolesScene hook failed: " + e);
    }

    // =============================================
    // 6. Hook BaseNetScene.getFormDataStringBuilder 
    //    捕获所有 form-data 参数构建
    // =============================================
    try {
        var BaseNetScene = Java.use("com.tencent.gamehelper.netscene.base.c");
        console.log("[+] Found BaseNetScene");

        BaseNetScene.getFormDataStringBuilder.implementation = function (map) {
            var result = this.getFormDataStringBuilder(map);
            if (map) {
                console.log("[FORM DATA] params map: " + map.toString());
            }
            if (result) {
                console.log("[FORM DATA] encoded: " + result.toString().substring(0, 500));
            }
            return result;
        };

        // Hook buildCommonParams
        BaseNetScene.buildCommonParams.implementation = function () {
            var params = this.buildCommonParams();
            if (params) {
                console.log("[COMMON PARAMS] " + params.toString());
            }
            return params;
        };
    } catch (e) {
        console.log("[-] BaseNetScene hook failed: " + e);
    }

    // =============================================
    // 7. Hook Gh-Header 构造 (bonus: 能看到 header 怎么生成)
    // =============================================
    try {
        var ProtocolRequest2 = Java.use("com.tencent.gamehelper.netscene.base.i");
        ProtocolRequest2.addHeader.implementation = function (name, value) {
            if (name === "Gh-Header" || name === "Content-Encrypt" || name === "Accept-Encrypt") {
                console.log("[HEADER] " + name + ": " + value);
            }
            return this.addHeader(name, value);
        };
    } catch (e) {
        console.log("[-] addHeader hook failed: " + e);
    }

    console.log("\n[*] All hooks installed! Waiting for API calls...");
    console.log("[*] Operate in the app now (send message / switch role / etc.)");
    console.log("[*] Files will be saved to /data/local/tmp/");
    console.log("[*] Use 'adb pull /data/local/tmp/req_plain_*.bin' to retrieve\n");
});
