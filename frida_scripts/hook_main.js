"use strict";
console.log("[*] Hooking main process...");

// Hook send
var send = Module.findExportByName("libc.so", "send");
if (send) {
    console.log("[+] send at: " + send);
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
} else {
    console.log("[-] send not found");
}

// 定期检查 libapp.so
var t = 0;
var checkLibapp = setInterval(function() {
    t++;
    try {
        var libapp = Process.findModuleByName("libapp.so");
        if (libapp) {
            console.log("[+] libapp.so found at: " + libapp.base);
            clearInterval(checkLibapp);
        }
    } catch (e) {}
    
    if (t > 60) {
        clearInterval(checkLibapp);
    }
}, 1000);

console.log("[*] Hooks installed, waiting 60s for send...");
