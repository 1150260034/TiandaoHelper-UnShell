"use strict";
console.log("[*] Frida hook loaded, waiting for libapp.so...");

var libapp = null;
var attempts = 0;
while (!libapp && attempts < 30) {
    try {
        libapp = Process.getModuleByName("libapp.so");
        console.log("[+] Found libapp.so at: " + libapp.base);
    } catch (e) {
        attempts++;
        sleep(1000);
    }
}

if (!libapp) {
    console.log("[-] libapp.so not found");
    Process.exit(1);
}

// Hook send
var send = Module.findExportByName("libc.so", "send");
if (send) {
    Interceptor.attach(send, {
        onEnter: function(args) {
            console.log("\n=== send() ===");
            console.log(hexdump(args[1], {length: Math.min(args[2].toInt32(), 512)}));
        }
    });
}

console.log("[*] Waiting 60s for sendmessage...");
setTimeout(function() { Process.exit(0); }, 60000);
