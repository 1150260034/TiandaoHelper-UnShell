#!/usr/bin/env python3
"""Analyze switchrole HAR capture - hex dump version."""
import json
import base64
import struct

har_path = r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\切换角色\0326-切角色1.har'
with open(har_path, 'r', encoding='utf-8-sig') as f:
    har = json.load(f)

entries = har['log']['entries']

def hex_dump(data, width=16):
    """Pretty hex dump."""
    lines = []
    for offset in range(0, min(len(data), 256), width):
        chunk = data[offset:offset+width]
        hex_part = ' '.join(f'{b:02x}' for b in chunk)
        ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
        lines.append(f"  {offset:04x}: {hex_part:<48s} {ascii_part}")
    if len(data) > 256:
        lines.append(f"  ... ({len(data)} bytes total)")
    return '\n'.join(lines)

def try_decode_text(text):
    """Try various ways to get binary from HAR text."""
    # Try latin-1 first (preserves all bytes)
    try:
        return text.encode('latin-1')
    except:
        pass
    try:
        return text.encode('utf-8')
    except:
        pass
    return None

for i in [0, 1]:
    e = entries[i]
    req = e['request']
    print(f"=== Entry [{i}] ===")
    print(f"URL: {req['url']}")
    print(f"Gh-Header: ", end='')
    for h in req.get('headers', []):
        if h['name'] == 'Gh-Header':
            print(h['value'])
            break
    print()

    # Request body hex dump
    post = req.get('postData', {})
    text = post.get('text', '')
    raw = try_decode_text(text)
    if raw:
        print(f"--- Request Body ({len(raw)} bytes) ---")
        print(hex_dump(raw))
        # Check if it looks like JCE/ProtoBuf
        print(f"\n  First 4 bytes as uint32 BE: {struct.unpack('>I', raw[:4])[0] if len(raw) >= 4 else 'N/A'}")
        print(f"  First 4 bytes as uint32 LE: {struct.unpack('<I', raw[:4])[0] if len(raw) >= 4 else 'N/A'}")
    print()

    # Response body hex dump
    resp = e['response']
    content = resp.get('content', {})
    encoding = content.get('encoding', '')
    resp_text = content.get('text', '')
    if encoding == 'base64' and resp_text:
        resp_raw = base64.b64decode(resp_text)
    elif resp_text:
        resp_raw = try_decode_text(resp_text)
    else:
        resp_raw = None
    if resp_raw:
        print(f"--- Response Body ({len(resp_raw)} bytes) ---")
        print(hex_dump(resp_raw))
    print()
    print()
