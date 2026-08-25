import base64
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

import websocket

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
edge = Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
profile = ROOT / 'tmp' / 'pdfs' / 'edge-profile'
profile.mkdir(parents=True, exist_ok=True)
url = ROOT.joinpath('index.html').as_uri()
proc = subprocess.Popen([
    str(edge), '--headless=new', '--disable-gpu', '--remote-debugging-port=9223',
    '--remote-allow-origins=*', f'--user-data-dir={profile}', url,
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

try:
    targets = None
    for _ in range(50):
        try:
            targets = json.load(urllib.request.urlopen('http://127.0.0.1:9223/json'))
            if targets:
                break
        except Exception:
            time.sleep(.2)
    page = next(t for t in targets if t.get('type') == 'page')
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=120)
    counter = 0

    def evaluate(expression):
        global counter
        counter += 1
        ws.send(json.dumps({'id': counter, 'method': 'Runtime.evaluate', 'params': {
            'expression': expression, 'awaitPromise': True, 'returnByValue': True,
        }}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == counter:
                result = msg['result']['result']
                if result.get('subtype') == 'error':
                    raise RuntimeError(result.get('description'))
                return result.get('value')

    evaluate('document.fonts.ready')
    for sheet, name in [(False, '课程表-A4大版-矢量.pdf'), (True, '课程表-8联小版-矢量.pdf')]:
        encoded = evaluate("createVectorPdf(%s).then(b=>{let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s)})" % str(sheet).lower())
        (OUT / name).write_bytes(base64.b64decode(encoded))
    ws.close()
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
