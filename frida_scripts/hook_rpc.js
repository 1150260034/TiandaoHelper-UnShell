"use strict";
console.log("[*] RPC hook loaded");

rpc.exports = {
    enumerateExports: function() {
        var libc = Process.findModuleByName("libc.so");
        var exports = libc.enumerateExports();
        return exports.filter(function(e) {
            return e.name.includes("send") || e.name.includes("write") || e.name.includes("socket");
        }).map(function(e) { return e.name; });
    }
};

console.log("[*] RPC exports ready");
