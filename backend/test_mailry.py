import urllib.request, urllib.error, json, sys, os

url = 'http://127.0.0.1:8001/admin/mailry/test?to=zahrasuhada17@gmail.com&name=Zahra'
req = urllib.request.Request(url, headers={'Accept': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode('utf-8', errors='replace')
        print('STATUS', r.status)
        print(body)
except urllib.error.HTTPError as e:
    print('HTTP ERROR', e.code)
    try:
        print(e.read().decode('utf-8', errors='replace'))
    except Exception:
        pass
except Exception as e:
    print('ERROR', e)
