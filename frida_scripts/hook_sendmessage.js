/**
 * Hook to enumerate all modules and check for libapp.so
 */

setTimeout(function() {
  console.log("[*] Frida module monitor loaded");

  var checkedModules = new Set();

  // Enumerate modules every 2 seconds
  setInterval(function() {
    var modules = Process.enumerateModules();
    var found = false;

    for (var i = 0; i < modules.length; i++) {
      var name = modules[i].name;
      if (!checkedModules.has(name)) {
        checkedModules.add(name);
        // Look for app-related libraries
        if (name.includes("app") || name.includes("helper") || name.includes("tencent") || name.includes("object")) {
          console.log("[+] New module: " + name + " @ " + modules[i].base + " (size: " + modules[i].size + ")");

          // If this is libapp.so, enumerate its exports
          if (name === "libapp.so") {
            console.log("[*] Found libapp.so! Enumerating exports...");
            var exports = modules[i].enumerateExports();
            console.log("[*] Total exports: " + exports.length);

            // Find send/msg related exports
            var targetExports = exports.filter(function(e) {
              return e.name.toLowerCase().includes('send') ||
                     e.name.toLowerCase().includes('msg') ||
                     e.name.toLowerCase().includes('obx') ||
                     e.name.toLowerCase().includes('sync') ||
                     e.name.toLowerCase().includes('comment');
            });

            console.log("[*] Target exports (" + targetExports.length + "):");
            targetExports.forEach(function(e) {
              console.log("  " + e.name + " @ " + e.address);
            });
          }
        }
      }
    }

    // Also print module count periodically
    if (modules.length > 0 && modules.length !== found) {
      found = true;
      console.log("[*] Total modules loaded: " + modules.length);
    }
  }, 2000);

  // Hook send to capture network traffic
  var libc = Process.getModuleByName("libc.so");
  var sendAddr = libc.getExportByName("send");
  console.log("[+] Hooking send() at: " + sendAddr);

  Interceptor.attach(sendAddr, {
    onEnter: function(args) {
      this.fd = args[0].toInt32();
      this.buf = args[1];
      this.len = args[2].toInt32();
    },
    onLeave: function(retval) {
      var ret = retval.toInt32();
      // Only print if it's a meaningful size (> 50 bytes)
      if (ret > 50 && this.len > 50) {
        console.log("\n=== send() large packet ===");
        console.log("fd: " + this.fd + ", len: " + this.len + ", returned: " + ret);
        console.log("Hex dump:");
        console.log(hexdump(this.buf, {length: Math.min(this.len, 1024)}));
      }
    }
  });

  console.log("[*] Monitoring for 60 seconds...");

  // Stop after 60 seconds
  setTimeout(function() {
    console.log("[*] Monitoring complete");
    console.log("[*] Total modules seen: " + checkedModules.size);
  }, 60000);

}, 1000);
