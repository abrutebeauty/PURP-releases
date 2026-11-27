#!/usr/bin/env python3
"""COREKULT day mode generator.
Reads a site CSS file and writes day-<name>.css: every colour rule repeated under html[data-theme=day]
with a light-palette colour. Images are never touched (filter / background-image urls are skipped).
Usage: daygen.py <site dir> shop.css bundle.css ...   (re-run after big CSS changes, then bump ?v)"""
import re, sys, os, colorsys

D = 'html[data-theme="day"]'
COLOR_PROPS = {'color', 'background', 'background-color', 'border', 'border-color', 'border-top', 'border-bottom',
               'border-left', 'border-right', 'border-top-color', 'border-bottom-color', 'border-left-color',
               'border-right-color', 'outline', 'outline-color', 'box-shadow', 'text-shadow', 'fill', 'stroke',
               'caret-color', 'accent-color', 'text-decoration-color', 'column-rule', 'scrollbar-color',
               '-webkit-text-stroke', '-webkit-text-fill-color'}
NAMED = {'white': (255, 255, 255, 1), 'black': (0, 0, 0, 1), '#fff': (255, 255, 255, 1), '#000': (0, 0, 0, 1)}
COL_RE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b')

def parse(c):
    c = c.strip().lower()
    if c in NAMED: return NAMED[c]
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4): h = ''.join(x * 2 for x in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return (r, g, b, a)
    nums = re.findall(r'[\d.]+%?', c)
    if '%' in ''.join(nums[:3]) or len(nums) < 3: return None
    r, g, b = (float(x) for x in nums[:3])
    a = float(nums[3].rstrip('%')) / (100 if nums[3].endswith('%') else 1) if len(nums) > 3 else 1
    return (r, g, b, a)

def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(x))) for x in (r, g, b))
    if a >= 0.999: return '#%02x%02x%02x' % (r, g, b)
    return 'rgba(%d,%d,%d,%s)' % (r, g, b, ('%.3f' % max(0, min(1, a))).rstrip('0').rstrip('.') or '0')

def hls(r, g, b): return colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

# day palette
INK = (22, 20, 28)          # text
BG = (239, 236, 230)        # page: warm off-white
ACID_INK = (88, 102, 0)     # acid yellow used as text / line -> deep olive (AA on the light greys)
PURPLE_INK = (91, 63, 214)  # purple as text / line
RED_INK = (196, 15, 37)

def kind(rgb):
    r, g, b = rgb; h, l, s = hls(r, g, b)
    if abs(r - 228) < 30 and g > 225 and b < 140: return 'acid'
    if s < 0.18 or l < 0.09 or (l > 0.8 and s < 0.7 and not (0.68 < h < 0.80 and s > 0.4)): return 'neutral'   # warm off-whites (#f2efe9) count as neutral
    if 0.68 < h < 0.80: return 'purple'
    if (h < 0.03 or h > 0.95) and s > 0.5 and l < 0.6: return 'red'
    return 'hue'

def surface(l):  # night lightness (0..~0.35) -> day surface, darker when it was lighter at night
    t = max(0.0, min(1.0, (l - 0.04) / 0.30))
    lo, hi = BG, (196, 192, 184)
    return tuple(lo[i] + (hi[i] - lo[i]) * t for i in range(3))

def darken(rgb, k):
    return tuple(x * (1 - k) for x in rgb)

def map_color(c, prop, keep_fg):
    p = parse(c)
    if not p: return c
    r, g, b, a = p; k = kind((r, g, b)); h, l, s = hls(r, g, b)
    shadow = prop in ('box-shadow', 'text-shadow')
    fg = prop in ('color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color', 'text-decoration-color', '-webkit-text-stroke')
    line = prop.startswith('border') or prop.startswith('outline') or prop in ('column-rule', 'accent-color')
    if k == 'neutral':
        if shadow:
            if l < 0.5: return fmt(40, 30, 60, a * 0.35)
            return fmt(*INK, a * 0.5)
        if fg:
            if l > 0.5: return c if keep_fg else fmt(*INK, a)
            return c                                        # dark text sits on bright fills: stays dark
        if line:
            if l > 0.5: return fmt(0, 0, 0, min(1, a * 1.25))
            return fmt(*surface(l + 0.12), a) if a > 0.5 else fmt(0, 0, 0, a * 0.6)
        # backgrounds
        if l > 0.5:
            if a < 0.5: return fmt(0, 0, 0, a * 0.8)       # light hover tint -> dark tint
            return c                                        # light blocks (white buttons) stay light, their text is dark
        if a < 0.5: return c                                # dark tints darken in both modes
        if r == g == b == 0 and a > 0.9: return fmt(226, 223, 216, 1)
        if r == g == b == 0: return fmt(0, 0, 0, a * 0.45)  # black scrims: lighter
        return fmt(*surface(l), a)
    if k == 'acid':
        if fg or line: return fmt(*ACID_INK, max(a, 0.55) if a > 0.2 else a * 2)
        if shadow: return fmt(*ACID_INK, a * 0.5)
        if a < 0.6: return fmt(200, 228, 0, min(1, a * 1.6))
        return c                                            # acid fills stay acid (dark text on top)
    if k == 'purple':
        if fg or line:
            return fmt(*(darken(PURPLE_INK, 0.15) if l > 0.75 else PURPLE_INK), a) if not keep_fg or line else c
        if shadow: return fmt(*PURPLE_INK, a * 0.6)
        return c
    if k == 'red':
        if fg or line: return fmt(*RED_INK, a)
        return c
    # other hues (category colours, green, pink, blue...)
    if fg or line:
        if keep_fg: return c
        return fmt(*darken((r, g, b), 0.45 if l > 0.55 else 0.3), max(a, 0.6) if a > 0.25 else a)
    if shadow: return fmt(r, g, b, a * 0.6)
    return c

VAR_MAP_FG = {'var(--acid)': 'var(--acid-ink)', 'var(--purple)': 'var(--purple-ink)'}

def map_value(prop, val, keep_fg, bg_kept):
    if 'url(' in val:
        # only remap colours outside url(...) for background shorthand, keep the image itself
        pass
    out = val
    fg = prop in ('color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color')
    line = prop.startswith('border') or prop.startswith('outline') or prop in ('box-shadow', 'text-shadow')
    if fg or line:
        for k2, v2 in VAR_MAP_FG.items():
            if k2 in out and not (fg and keep_fg): out = out.replace(k2, v2)
    if fg and bg_kept:  # dark text on acid/purple fills written as var(--bg)
        out = re.sub(r'var\(--(bg|panel|tile|tile2)(,[^)]*)?\)', '#0b0a0e', out)
    parts = re.split(r'(url\([^)]*\)|"[^"]*"|\'[^\']*\')', out)
    for i in range(0, len(parts), 2):
        parts[i] = COL_RE.sub(lambda m: map_color(m.group(0), prop, keep_fg), parts[i])
    return ''.join(parts)

def scope(sel):
    out = []
    for s in split_top(sel, ','):
        s = s.strip()
        if not s: continue
        if s.startswith(':root'): out.append(D + s[5:])
        elif re.match(r'html\b', s): out.append(D + s[4:])
        else: out.append(D + ' ' + s)
    return ','.join(out)

def split_top(s, ch):
    out, depth, cur = [], 0, ''
    for c in s:
        if c in '([': depth += 1
        elif c in ')]': depth -= 1
        if c == ch and depth == 0: out.append(cur); cur = ''
        else: cur += c
    out.append(cur); return out

def decls(body):
    res = []
    for d in split_top(body, ';'):
        if ':' not in d: continue
        p, v = d.split(':', 1); p = p.strip().lower(); v = v.strip()
        if p: res.append((p, v))
    return res

def is_kept_bg(v):
    if 'var(--acid)' in v or 'var(--purple)' in v: return True
    for m in COL_RE.finditer(re.sub(r'url\([^)]*\)', '', v)):
        p = parse(m.group(0))
        if p and p[3] > 0.6 and kind(p[:3]) in ('acid', 'purple', 'red', 'hue'): return True
    return False

def rule_out(sel, body):
    ds = decls(body)
    bgs = [v for p, v in ds if p in ('background', 'background-color')]
    bg_kept = any(is_kept_bg(v) for v in bgs)
    # keep light text only on purple/red/hue fills; on acid fills text is dark anyway
    keep_fg = bg_kept and not any('var(--acid)' in v or any((lambda q: q and kind(q[:3]) == 'acid')(parse(m.group(0))) for m in COL_RE.finditer(v)) for v in bgs)
    bg_ink = any('var(--ink)' in v for v in bgs)
    out = []
    for p, v in ds:
        if p.startswith('--'):
            continue
        if p not in COLOR_PROPS: continue
        nv = map_value(p, v, keep_fg, bg_kept)
        if p == 'color' and bg_ink:   # light block at night (var(--ink)) is a dark block by day: its dark text turns light
            q = parse(v) if COL_RE.fullmatch(v.strip()) else None
            if (q and kind(q[:3]) == 'neutral' and hls(*q[:3])[1] < 0.3) or re.search(r'var\(--(bg|panel)', v): nv = 'var(--bg)'
        out.append((p, nv, nv != v))
    # re-state unchanged colours too, so a later night rule is not beaten by an earlier day rule (same specificity + prefix)
    if not out: return ''
    out = [f'{p}:{nv}' for p, nv, ch in out]
    return scope(sel) + '{' + ';'.join(out) + '}'

def strip_comments(css): return re.sub(r'/\*.*?\*/', '', css, flags=re.S)

def walk(css):
    """yield output css for a block of rules"""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        head = css[i:j].strip()
        # find matching brace
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if head.startswith('@media') or head.startswith('@supports') or head.startswith('@container'):
            inner = walk(body)
            if inner: out.append(head + '{' + inner + '}')
        elif head.startswith('@'):
            pass  # keyframes, font-face: left alone
        elif head:
            r = rule_out(head, body)
            if r: out.append(r)
        i = k
    return '\n'.join(out)

if __name__ == '__main__':
    site = sys.argv[1]
    for f in sys.argv[2:]:
        src = open(os.path.join(site, f)).read()
        res = walk(strip_comments(src))
        name = 'day-' + os.path.basename(f)
        with open(os.path.join(site, name), 'w') as fh:
            fh.write(f'/* AUTO: day-mode colours for {f}, made by corekult-site/daymode/daygen.py. Do not edit by hand: edit day.css. */\n' + res + '\n')
        print(name, len(res.splitlines()), 'rules')
