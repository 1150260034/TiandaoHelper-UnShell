# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UnShellX is a reverse engineering project to unpack and decompile **天刀助手** (TiandaoHelper), an Android app protected with **腾讯乐固 4.6.2.2 + 梆梆加固** shell protection.

**Target App**: `com.tencent.gamehelper.wuxia`
**Goal**: Extract decrypted DEX files and decompile to Java source code

## Common Commands

### Frida Unpacking (on Android emulator/rooted device)
```bash
# Start app and inject unpack script
frida -U -f com.tencent.gamehelper.wuxia \
      -l frida_scripts/unshell_dexdump.js --no-pause

# Extract dumped files
adb pull /data/local/tmp/unshell/ ./dumped/
```

### Decompile
```bash
# Use jadx (recommended)
jadx-gui ./dumped/classes.dex

# Or apktool (may fail on shell-protected APK)
apktool d base.apk -o decoded/
```

### Scripts
```bash
# Full pipeline: unpack + extract + decompile
./scripts/full_pipeline.sh

# Quick unpack and pull
./scripts/unshell_and_pull.sh [TIMEOUT_SECONDS]
```

## Architecture

```
frida_scripts/     # Frida JS scripts for hooking ClassLoader/DexFile/native
scripts/           # Shell/batch automation scripts
tools/             # Downloadable tools (jadx, apktool, dex2jar)
```

## Key Findings

- **Shell DEX**: `classes.dex` has header `dex.035` (not real DEX)
- **Encrypted DEX**: `assets/0OO00l111l1l` (19MB) contains the real DEX
- **Shell SO**: `lib/arm64-v8a/libshell-super.com.tencent.gamehelper.wuxia.so`

## Notes

- Frida scripts hook `ClassLoader.loadClass`, `DexFile`, and native `android_dlopen_ext`
- The `.gitignore` at `~/` globally ignores `*.md` - use `git add -f` for markdown files in this repo
- Download tools (jadx, apktool, dex2jar) to `tools/` directory - see `tools/README.md`
