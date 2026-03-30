"use strict";
console.log("[*] Waiting for libapp.so...");

// 等待 libapp.so 出现
var t = 0;
var checkLibapp = setInterval(function() {
    t++;
    try {
        var libapp = Process.findModuleByName("libapp.so");
        if (libapp) {
            console.log("[+] libapp.so found at: " + libapp.base);
            clearInterval(checkLibapp);
            
            // 枚举 libapp.so 导出
            console.log("[*] Enumerating libapp.so exports...");
            libapp.enumerateExports().forEach(function(e) {
                if (e.name.includes("send") || e.name.includes("message") || e.name.includes("obx") || e.name.includes("sync")) {
                    console.log("  " + e.name + " @ " + e.address);
                }
            });
            
            // Hook send
            var send = Module.findExportByName("libc.so", "send");
            if (send) {
                console.log("[+] Hooking send...");
                Interceptor.attach(send, {
                    onEnter: function(args) {
                        this.fd = args[0].toInt32();
                        this.len = args[2].toInt32();
                        this.buf = args[1];
                    },
                    onLeave: function(retval) {
                        if (this.len > 50 && this.len < 5000) {
                            console.log("\n=== send() fd=" + this.fd + " len=" + this.len + " ===");
                            console.log(hexdump(this.buf, {length: Math.min(this.len, 1024)}));
                        }
                    }
                });
                console.log("[+] send hooked!");
            }
        }
    } catch (e) {
        if (t % 10 == 0) console.log("[-] Still waiting... (" + t + "s)");
    }
    
    if (t > 120) {
        clearInterval(checkLibapp);
        console.log("[-] Timeout");
    }
}, 1000);

console.log("[*] Will check for libapp.so every second for 120s...");
