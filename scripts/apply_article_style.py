#!/usr/bin/env python3
"""scripts/article_style.css を articles/*.html の <style> に反映する（全記事を必ず同一に保つ）。

あわせて共通部品 D4（kit/）の読み込みを <style> の直前に入れ、<body> に k-page を付ける。
筆（Yuji Syuku）と太字（RocknRoll One）は、その記事で筆・太字になる字（サイト名・h1・h2・
「先に結論」・目次の見出し・ツールへの導線）だけを text= で頼む。何度回しても同じ結果になる。
"""
import glob, html, os, re, urllib.parse
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = open(os.path.join(root, "scripts", "article_style.css"), encoding="utf-8").read().strip("\n")

D4_START, D4_END = "<!-- D4_KIT_START（scripts/apply_article_style.py が書く。手で直さない） -->", "<!-- D4_KIT_END -->"
FONT_TARGETS = [
    r'<p class="site-name">(.*?)</p>',
    r"<h1[^>]*>(.*?)</h1>",
    r"<h2[^>]*>(.*?)</h2>",
    r'<span class="point-label">(.*?)</span>',
    r'<div class="toc">\s*<b>(.*?)</b>',
    r'<div class="toolcta">.*?<a [^>]*>(.*?)</a>',
]


def font_link(s):
    body = s[s.find("<body"):]
    parts = []
    for pat in FONT_TARGETS:
        parts += [re.sub(r"<[^>]+>", "", m) for m in re.findall(pat, body, flags=re.S)]
    txt = html.unescape("".join(parts)) + "0123456789"
    chars = "".join(sorted({c for c in txt if not c.isspace()}))
    return ('<link href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=RocknRoll+One&display=swap&text='
            + urllib.parse.quote(chars, safe="") + '" rel="stylesheet">')


def d4_block(s):
    return "\n".join([
        D4_START,
        font_link(s),
        "<!-- 共通部品 D4（kkp-kit を kit/ にコピーしたもの。中は手で直さず kkp-kit 側で直して sync.sh） -->",
        '<link rel="stylesheet" href="/kit/kit.css">',
        '<script src="/kit/kit.js" defer></script>',
        D4_END,
    ]) + "\n"


for p in sorted(glob.glob(os.path.join(root, "articles", "*.html"))):
    s = open(p, encoding="utf-8").read()
    new, n = re.subn(r"<style>\n.*?\n</style>", lambda m: "<style>\n" + css + "\n</style>", s, count=1, flags=re.S)
    assert n == 1, p
    # D4 の読み込み（前に入れたものは消してから入れ直す）
    new = re.sub(re.escape(D4_START) + r".*?" + re.escape(D4_END) + r"\n", "", new, flags=re.S)
    i = new.index("<style>\n")
    new = new[:i] + d4_block(new) + new[i:]
    new, n = re.subn(r"<body(?: class=\"k-page\")?>", '<body class="k-page">', new, count=1)
    assert n == 1, p
    if new != s:
        open(p, "w", encoding="utf-8").write(new)
    print(("updated  " if new != s else "unchanged"), os.path.basename(p))
