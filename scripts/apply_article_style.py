#!/usr/bin/env python3
"""scripts/article_style.css を articles/*.html の <style> に反映する（5記事を必ず同一に保つ）。"""
import glob, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = open(os.path.join(root, "scripts", "article_style.css"), encoding="utf-8").read().strip("\n")
for p in sorted(glob.glob(os.path.join(root, "articles", "*.html"))):
    s = open(p, encoding="utf-8").read()
    new, n = re.subn(r"<style>\n.*?\n</style>", lambda m: "<style>\n" + css + "\n</style>", s, count=1, flags=re.S)
    assert n == 1, p
    if new != s:
        open(p, "w", encoding="utf-8").write(new)
    print(("updated  " if new != s else "unchanged"), os.path.basename(p))
