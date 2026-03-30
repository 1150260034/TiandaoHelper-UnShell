"use strict";
console.log("[*] Simple send hook loaded");

try {
    var sendPtr = Module.findExportByName("libc.so", "send");
    console.log("[+] send at: " + sendPtr);
    if (sendPtr) {
        Interceptor.attach(sendPtr, {
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
    }
} catch (e) {
    console.log("[-] send error: " + e);
}

try {
    var writePtr = Module.findExportByName("libc.so", "write");
    console.log("[+] write at: " + writePtr);
    if (writePtr) {
        Interceptor.attach(writePtr, {
            onEnter: function(args) {
                this.len = args[2].toInt32();
                this.buf = args[1];
            },
            onLeave: function(retval) {
                if (this.len > 50 && this.len < 5000) {
                    console.log("\n=== write() len=" + this.len + " ===");
                    console.log(hexdump(this.buf, {length: Math.min(this.len, 1024)}));
                }
            }
        });
    }
} catch (e) {
    console.log("[-] write error: " + e);
}

console.log("[*] Hooks installed");
