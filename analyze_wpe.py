#!/usr/bin/env python3
"""Analyze 全民礼包 WPEIndex API calls in detail."""
import json
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def analyze_wpe(har_path, label):
    with open(har_path, 'r', encoding='utf-8-sig') as f:
        har = json.load(f)
    entries = har['log']['entries']
    
    for i, e in enumerate(entries):
        url = e['request']['url']
        if 'WPEIndex' not in url and 'RoleSrv' not in url:
            continue
        method = e['request']['method']
        if method == 'OPTIONS':
            continue
        
        status = e['response']['status']
        
        print(f"\n{'='*60}")
        print(f"{label} [{i}] {method} {url}")
        print(f"{'='*60}")
        
        # Request body
        post = e['request'].get('postData', {})
        post_text = post.get('text', '')
        if post_text:
            try:
                j = json.loads(post_text)
                print(f"REQUEST:")
                print(json.dumps(j, ensure_ascii=False, indent=2)[:1000])
            except:
                print(f"REQUEST: {post_text[:500]}")
        
        # Response body
        resp_text = e['response']['content'].get('text', '')
        if resp_text:
            try:
                j = json.loads(resp_text)
                print(f"\nRESPONSE:")
                print(json.dumps(j, ensure_ascii=False, indent=2)[:1000])
            except:
                print(f"\nRESPONSE: {resp_text[:500]}")

# Analyze 0326-全民礼包.har (main account)
print("#" * 60)
print("# 全民礼包 主号 (0326)")
print("#" * 60)
analyze_wpe(r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\0326-全民礼包.har', "主号")

print("\n\n")

# Analyze 0143-全民礼包-小号.har
print("#" * 60)
print("# 全民礼包 小号 (0143)")
print("#" * 60)
analyze_wpe(r'c:\Users\wangyiqi\Desktop\auto-sign\fidder\0143-全民礼包-小号.har', "小号")
