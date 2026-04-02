#!/usr/bin/env python3
"""Check HAR binary data preservation."""
import json

har_path = r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\切换角色\0326-切角色1.har'
with open(har_path, 'rb') as f:
    content = f.read()

# Check for encoding hints
for pat in [b'"encoding"', b'base64', b'postData', b'application/octet-stream']:
    positions = []
    search_idx = 0
    while True:
        p = content.find(pat, search_idx)
        if p == -1:
            break
        positions.append(p)
        search_idx = p + 1
        if len(positions) > 20:
            break
    print(f'Pattern {pat}: found {len(positions)} times')

# Now parse and check the actual content-length vs stored text length
with open(har_path, 'r', encoding='utf-8-sig') as f:
    har = json.load(f)

for i in [0, 1]:
    e = har['log']['entries'][i]
    req = e['request']
    # Get content-length from headers
    cl = ''
    for h in req.get('headers', []):
        if h['name'].lower() == 'content-length':
            cl = h['value']
    post = req.get('postData', {})
    text = post.get('text', '')
    text_bytes_utf8 = len(text.encode('utf-8'))
    text_bytes_latin1 = 0
    try:
        text_bytes_latin1 = len(text.encode('latin-1'))
    except:
        text_bytes_latin1 = -1
    
    print(f"\nEntry [{i}]:")
    print(f"  Content-Length header: {cl}")
    print(f"  postData text chars: {len(text)}")
    print(f"  postData text UTF-8 bytes: {text_bytes_utf8}")
    print(f"  postData text Latin-1 bytes: {text_bytes_latin1}")
    print(f"  Mismatch (CL vs stored): CL={cl}, UTF8={text_bytes_utf8}, Latin1={text_bytes_latin1}")
    
    # Check response
    resp_content = e['response']['content']
    print(f"  Response encoding: {resp_content.get('encoding', 'NONE')}")
    print(f"  Response size: {resp_content.get('size', 0)}")
    resp_text = resp_content.get('text', '')
    if resp_text:
        print(f"  Response text chars: {len(resp_text)}")
