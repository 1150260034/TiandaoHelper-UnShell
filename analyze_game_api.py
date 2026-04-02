#!/usr/bin/env python3
"""Analyze start game and sendmessage HAR files in detail."""
import json
import base64
import urllib.parse

def hex_dump(data, limit=256, width=16):
    lines = []
    for offset in range(0, min(len(data), limit), width):
        chunk = data[offset:offset+width]
        hex_part = ' '.join(f'{b:02x}' for b in chunk)
        ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
        lines.append(f"  {offset:04x}: {hex_part:<48s} {ascii_part}")
    if len(data) > limit:
        lines.append(f"  ... ({len(data)} bytes total)")
    return '\n'.join(lines)

def analyze_entry(har_path, entry_idx, label=""):
    with open(har_path, 'r', encoding='utf-8-sig') as f:
        har = json.load(f)
    e = har['log']['entries'][entry_idx]
    req = e['request']
    resp = e['response']

    print(f"\n{'='*60}")
    print(f"{label} [{entry_idx}] {req['method']} {req['url'][:150]}")
    print(f"{'='*60}")

    # Request headers
    print("Request Headers:")
    for h in req.get('headers', []):
        name = h['name']
        if name.lower() in ('content-type', 'gh-header', 'cookie', 'referer', 'x-requested-with', 'user-agent'):
            val = h['value']
            if name.lower() == 'cookie' and len(val) > 200:
                val = val[:200] + '...'
            print(f"  {name}: {val}")

    # Request body
    post = req.get('postData', {})
    post_text = post.get('text', '')
    post_mime = post.get('mimeType', '')
    if post_text:
        print(f"\nRequest Body (mime={post_mime}, chars={len(post_text)}):")
        if 'octet-stream' in post_mime:
            try:
                raw = post_text.encode('latin-1')
                print(hex_dump(raw, 256))
            except:
                print(f"  (UTF-8 corrupted binary, {len(post_text)} chars)")
        elif 'json' in post_mime:
            try:
                j = json.loads(post_text)
                print(f"  {json.dumps(j, ensure_ascii=False, indent=2)[:500]}")
            except:
                print(f"  {post_text[:500]}")
        elif 'form' in post_mime:
            print(f"  {post_text[:500]}")
            # Also parse params
            params = post.get('params', [])
            if params:
                print(f"  Params ({len(params)}):")
                for p in params[:20]:
                    print(f"    {p.get('name','?')}={p.get('value','?')[:100]}")
        else:
            print(f"  {post_text[:500]}")

    # Response
    print(f"\nResponse: {resp['status']}")
    content = resp.get('content', {})
    resp_text = content.get('text', '')
    encoding = content.get('encoding', '')
    resp_mime = content.get('mimeType', '')
    print(f"  mimeType: {resp_mime}, size: {content.get('size', 0)}, encoding: {encoding or 'none'}")
    if encoding == 'base64' and resp_text:
        decoded = base64.b64decode(resp_text)
        print(f"  Decoded ({len(decoded)} bytes):")
        # Try text first
        try:
            text = decoded.decode('utf-8')
            print(f"  {text[:500]}")
        except:
            print(hex_dump(decoded, 256))
    elif resp_text:
        if 'html' in resp_mime or 'json' in resp_mime or 'text' in resp_mime:
            # Check if it's JSON
            try:
                j = json.loads(resp_text)
                print(f"  {json.dumps(j, ensure_ascii=False, indent=2)[:500]}")
            except:
                print(f"  {resp_text[:500]}")
        else:
            print(f"  {resp_text[:300]}")

# ==========================================
# 1. Analyze sendmessage (0105-发消息.har)
# ==========================================
print("\n" + "#"*60)
print("# SENDMESSAGE ANALYSIS")
print("#"*60)
har_path = r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\0105-发消息.har'
with open(har_path, 'r', encoding='utf-8-sig') as f:
    har = json.load(f)
# Find all entries
for i, e in enumerate(har['log']['entries']):
    url = e['request']['url']
    if 'sendmessage' in url.lower() or 'api2.helper' in url.lower():
        analyze_entry(har_path, i, "发消息")

# ==========================================
# 2. Analyze start game (0106-开始游戏.har)
# ==========================================
print("\n" + "#"*60)
print("# START GAME ANALYSIS")
print("#"*60)
har_path = r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\0106-开始游戏.har'
with open(har_path, 'r', encoding='utf-8-sig') as f:
    har = json.load(f)
for i, e in enumerate(har['log']['entries']):
    url = e['request']['url']
    if 'h5game' in url.lower() or 'ajax/login' in url.lower() or 'game2' in url.lower() or 'index2' in url.lower():
        analyze_entry(har_path, i, "开始游戏")

# Also check 0200-开始游戏-2.har for the full flow
print("\n" + "#"*60)
print("# START GAME FULL FLOW (0200)")
print("#"*60)
har_path = r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\0200-开始游戏-2.har'
with open(har_path, 'r', encoding='utf-8-sig') as f:
    har = json.load(f)
for i, e in enumerate(har['log']['entries']):
    url = e['request']['url']
    if 'index2' in url.lower() or 'ajax/login' in url.lower() or 'game2' in url.lower():
        analyze_entry(har_path, i, "开始游戏-2")
