"use strict";
console.log("[*] Dynamic hook loaded");

// 等待 libapp.so 加载
setTimeout(function() {
    console.log("[*] Checking for modules...");
    var modules = Process.enumerateModules();
    modules.forEach(function(m) {
        if (m.name.includes("libc") || m.name.includes("app")) {
            console.log("  " + m.name + " @ " + m.base);
        }
    });
    
    // Hook libc.so send
    var libc = Process.findModuleByName("libc.so");
    if (libc) {
        console.log("[+] libc.so found at " + libc.base);
        var send = libc.getExportByName("send");
        console.log("[+] send at: " + send);
        if (send) {
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
    
    // Hook libapp.so 导出
    var libapp = Process.findModuleByName("libapp.so");
    if (libapp) {
        console.log("[+] libapp.so found at " + libapp.base);
        libapp.enumerateExports().forEach(function(e) {
            if (e.name.includes("send") || e.name.includes("message")) {
                console.log("  export: " + e.name + " @ " + e.address);
            }
        });
    } else {
        console.log("[-] libapp.so not found");
    }
}, 2000);

console.log("[*] Waiting 2s before checking...");
