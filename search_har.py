#!/usr/bin/env python3
"""Search all HAR files for key API calls."""
import json
import os

har_dir = r'c:\Users\wangyiqi\Desktop\auto-sign\fidder'
keywords = ['sendmessage', 'switchrole', 'game2', 'h5game', 'startgame', 'wakeup']

for root, dirs, files in os.walk(har_dir):
    for f in files:
        if not f.endswith('.har'):
            continue
        path = os.path.join(root, f)
        try:
            with open(path, 'r', encoding='utf-8-sig') as fh:
                har = json.load(fh)
            entries = har['log']['entries']
            for i, e in enumerate(entries):
                url = e['request']['url'].lower()
                method = e['request']['method']
                for kw in keywords:
                    if kw in url:
                        rel = os.path.relpath(path, har_dir)
                        orig_url = e['request']['url'][:120]
                        ct_header = ''
                        gh_header = ''
                        for h in e['request'].get('headers', []):
                            if h['name'].lower() == 'content-type':
                                ct_header = h['value']
                            if h['name'].lower() == 'gh-header':
                                gh_header = h['value']
                        resp_status = e['response']['status']
                        resp_size = e['response']['content'].get('size', 0)
                        post_size = len(e['request'].get('postData', {}).get('text', ''))
                        print(f"{rel} [{i}] {method} {orig_url}")
                        if ct_header:
                            print(f"  CT: {ct_header}")
                        if gh_header:
                            print(f"  Gh: {gh_header}")
                        print(f"  PostSize: {post_size}  Resp: {resp_status} Size={resp_size}")
                        print()
                        break
        except Exception as ex:
            pass
