#!/usr/bin/env python3
"""Makes site/day-opium.css: day-mode colours for the OPIUM 2 look (opium.css + cs/*.css), using daygen.py.
Run from preview/: python3 tools/daygen-opium.py site   (re-run after the sources change, then bump ?v of day-opium.css)"""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
import daygen
site = sys.argv[1]
files = ['opium.css', 'cs/top.css', 'cs/pv.css', 'cs/bx.css', 'cs/cards.css', 'cs/story2.css']
out = ['/* AUTO: day colours for the OPIUM 2 look, made by tools/daygen-opium.py from ' + ', '.join(files) + '. Edit day-opium-fix.css for hand fixes, not this file. */']
for f in files:
    src = open(os.path.join(site, f)).read()
    out.append('/* ' + f + ' */\n' + daygen.walk(daygen.strip_comments(src)))
open(os.path.join(site, 'day-opium.css'), 'w').write('\n'.join(out) + '\n')
print('ok', sum(len(o.splitlines()) for o in out), 'lines')
