#!/usr/bin/env python3
"""Embed both volunteer checklists in the standalone page; standard library only."""
import csv
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
solo_only = set('GAME-001 GAME-011 GAME-016 NAME-001 NAME-002 NAME-003 RESULT-001 RESULT-002 RESULT-003 RESULT-004 RESULT-006 LB-001 LB-002 LB-003 LB-016 NET-003 NET-004 NET-008 DEVICE-001 DEVICE-002 DEVICE-003 DEVICE-004 DEVICE-005'.split())
multiplayer_only = set('NAME-004 NAME-005 NAME-006 NAME-007 NAME-008 NAME-009 NAME-010 NAME-011 RESULT-007 LB-008 LB-009 LB-010 LB-012 NET-005 NET-006'.split())
dates = set()
def catalogue(filename, extensive=False):
    with (root / filename).open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    tests = []
    for r in rows:
        id = r['Test ID']
        if id.startswith('WEB-'):
            modes = ['website']
        elif id.startswith('MP-') or extensive and id in multiplayer_only:
            modes = ['multiplayer']
        elif id.startswith('SHARE-') or extensive and id in solo_only:
            modes = ['solo']
        else:
            modes = ['solo', 'multiplayer']
        dates.add(r['Build Version'])
        sections = {'SMOKE': 'Getting started', 'UI': 'Getting started',
                    'GAME': 'Driving and devices', 'PAUSE': 'Driving and devices', 'DEVICE': 'Driving and devices',
                    'NAME': 'Players', 'MP': 'Players', 'RESULT': 'Results and leaderboards',
                    'LB': 'Results and leaderboards', 'NET': 'Results and leaderboards',
                    'SHARE': 'Highlights', 'WEB': 'Leaderboard website', 'BUG': 'Other bugs'}
        tests.append(dict(id=id, section=sections[id.split('-')[0]], category=r['Category'], title=r['Feature'].removeprefix('[REGRESSION] '),
                          regression=r['Feature'].startswith('[REGRESSION]'), priority=r['Priority'],
                          pre=r['Preconditions'], steps=re.split(r'\s+(?=\d+\. )', r['Steps']),
                          expected=r['Expected Result'], modes=modes))
    assert len({t['id'] for t in tests}) == len(tests), 'Test IDs must be unique within a checklist'
    return tests
short = catalogue('HUMAN_TEST_CHECKLIST.csv')
extensive = catalogue('EXTENSIVE_TEST_CHECKLIST.csv', extensive=True)
assert len(dates) == 1 and next(iter(dates)), 'Both checklists need the same build date'
payload = dict(build=next(iter(dates)), tests=short, extensiveTests=extensive)
page = root / 'index.html'
encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
html, count = re.subn(r'(?<=<!-- QA_DATA_START -->).*?(?=<!-- QA_DATA_END -->)',
                     lambda _: '\n<script id="qa-data" type="application/json">' + encoded + '</script>\n',
                     page.read_text(), flags=re.S)
assert count == 1
page.write_text(html)
print(f'Embedded {len(short)} short / {len(extensive)} extensive cases; build {payload["build"]}.')
