#!/usr/bin/env node
/*
 * 退職金の手取り早見表を機械的に算出する（articles/taishokukin-tedori 用）
 *
 *   node scripts/taishokukin_hayami.js          … 表・金額別ケース・ツールとの突き合わせを標準出力へ
 *   node scripts/taishokukin_hayami.js --html   … 記事に貼る HTML 断片だけを出力
 *   node scripts/taishokukin_hayami.js --write  … 記事の <!-- gen:NAME --> 〜 <!-- /gen:NAME --> と FAQPage JSON-LD を再計算結果で書き換える
 *   node scripts/taishokukin_hayami.js --check  … 記事 HTML 内の表と再計算結果が一致するか検査（不一致なら exit 1）
 *
 * 式の根拠（確認日 2026-09-19・いずれも本文を直接確認）
 *   国税庁 No.2732 退職手当等に対する源泉徴収 [令和8年4月1日現在法令等]
 *     https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2732.htm
 *     - 退職所得控除: 20年以下 40万円×A（80万円未満は80万円）／20年超 800万円+70万円×(A-20)
 *     - 一般退職手当等: (収入-控除)×1/2
 *     - 短期退職手当等（役員等以外で勤続5年以下）: 収入-控除≦300万円なら×1/2、
 *       300万円超なら 150万円+{収入-(300万円+控除)}
 *     - 課税退職所得金額は1,000円未満切捨て
 *   国税庁 別紙 退職所得の源泉徴収税額の速算表（税額=(A×B-C)×102.1%、1円未満切捨て）
 *     https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2732_besshi.htm
 *   国税庁 No.1420 退職金を受け取ったとき(退職所得)
 *     https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm
 *   住民税: 市町村民税6%・道府県民税4%、それぞれ100円未満切捨て
 *     総務省 https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/65871.html
 *     横浜市 退職所得の課税の特例（短期退職手当等は住民税も同じ扱い・令和4年分以後）
 *
 * 前提: 「退職所得の受給に関する申告書」提出済み／同じ年・前年以前に他の退職手当等なし／
 *       障害退職の加算なし／役員等（会社役員・議員・公務員）で勤続5年以下の特定役員退職手当等は対象外
 */
"use strict";
const fs = require("fs");
const path = require("path");

const YEARS = [5, 10, 15, 20, 25, 30, 35, 40];
const AMOUNTS_MAN = [500, 1000, 1500, 2000, 2500, 3000];
const CASES = { 1000: [20, 30, 38], 2000: [20, 30, 38], 3000: [20, 30, 38] };

// 速算表（上限, 税率の分子[%], 控除額）
const SOKUSAN = [
  [1950000, 5, 0],
  [3300000, 10, 97500],
  [6950000, 20, 427500],
  [9000000, 23, 636000],
  [18000000, 33, 1536000],
  [40000000, 40, 2796000],
  [Infinity, 45, 4796000],
];

function kojoYen(years) {
  const man = years <= 20 ? Math.max(80, 40 * years) : 800 + 70 * (years - 20);
  return man * 10000;
}

// すべて整数（円）で計算する
function calc(amountYen, years) {
  const kojo = kojoYen(years);
  const after = Math.max(0, amountYen - kojo);
  const tanki = years <= 5; // 短期退職手当等（役員等以外）
  let taxable;
  if (tanki && after > 3000000) taxable = 1500000 + (after - 3000000);
  else taxable = Math.floor(after / 2);
  taxable = Math.floor(taxable / 1000) * 1000; // 1,000円未満切捨て
  const [, rate, ded] = SOKUSAN.find(([upper]) => taxable <= upper);
  // (A×B-C)×102.1% を整数演算で。1円未満切捨て
  const base = (taxable * rate) / 100 - ded;
  const shotoku = Math.floor((base * 1021) / 1000);
  const shi = Math.floor((taxable * 6) / 100 / 100) * 100; // 市町村民税 100円未満切捨て
  const ken = Math.floor((taxable * 4) / 100 / 100) * 100; // 道府県民税 100円未満切捨て
  const jumin = shi + ken;
  const tax = shotoku + jumin;
  return { amountYen, years, kojo, after, tanki, halfAll: !(tanki && after > 3000000), taxable, rate, ded, shotoku, jumin, tax, net: amountYen - tax };
}

// index.html の calcTaishokukin をそのまま取り出して実行する（式の写し間違いを避ける）
function toolNetMan(amountMan, years) {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/function calcTaishokukin\(\)\{[\s\S]*?\n\}\n/);
  if (!m) throw new Error("index.html に calcTaishokukin が見つからない");
  const els = { "rk-amount": { value: String(amountMan) }, "rk-years": { value: String(years) }, "rk-result": { innerHTML: "", classList: { add() {} } } };
  const document = { getElementById: (id) => els[id] };
  const shareVals = {};
  const f1 = (n) => (Math.round(n * 10) / 10).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  new Function("document", "shareVals", "f1", m[0] + "calcTaishokukin();")(document, shareVals, f1);
  return shareVals.taishokukin.netMan;
}

const yen = (n) => n.toLocaleString("ja-JP") + "円";
const man1 = (n) => (Math.round(n / 1000) / 10).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); // 万円・小数1桁
const manInt = (n) => (n / 10000).toLocaleString("ja-JP");
const pct1 = (r) => (Math.round(r * 1000) / 10).toFixed(1);

function tableHTML(kind) {
  const head = `  <tr><th rowspan="2">勤続年数</th><th rowspan="2" class="num">控除額</th><th colspan="${AMOUNTS_MAN.length}" class="grp">退職金(額面)</th></tr>\n  <tr>${AMOUNTS_MAN.map((a) => `<th class="num">${a.toLocaleString("ja-JP")}万円</th>`).join("")}</tr>`;
  const rows = YEARS.map((y) => {
    const cells = AMOUNTS_MAN.map((a) => {
      const r = calc(a * 10000, y);
      const v = kind === "net" ? r.net : r.tax;
      return `<td class="num">${v === 0 ? "0" : man1(v)}</td>`;
    }).join("");
    return `  <tr><td>${y}年${y <= 5 ? "(※)" : ""}</td><td class="num">${manInt(kojoYen(y))}</td>${cells}</tr>`;
  });
  return `<table class="data" data-gen="taishokukin-${kind}">\n${head}\n${rows.join("\n")}\n</table>`;
}

function caseTableHTML(amountMan) {
  const head = "  <tr><th>勤続年数</th><th>控除額</th><th>課税退職所得</th><th>所得税(復興税込み)</th><th>住民税</th><th>税金合計</th><th>手取り</th></tr>";
  const rows = CASES[amountMan].map((y) => {
    const r = calc(amountMan * 10000, y);
    return `  <tr><td>${y}年</td><td class="num">${manInt(r.kojo)}万円</td><td class="num">${manInt(r.taxable)}万円</td><td class="num">${yen(r.shotoku)}</td><td class="num">${yen(r.jumin)}</td><td class="num">${yen(r.tax)}</td><td class="num"><b>${yen(r.net)}</b></td></tr>`;
  });
  return `<table class="data" data-gen="taishokukin-case-${amountMan}">\n${head}\n${rows.join("\n")}\n</table>`;
}

// h3 直下の1〜2行と FAQ の答え（表示と JSON-LD で同じ文を使う）
const caseQuestion = (amountMan) => `退職金${amountMan.toLocaleString("ja-JP")}万円の手取りはいくら?`;
function caseSentence(amountMan) {
  const rs = CASES[amountMan].map((y) => calc(amountMan * 10000, y));
  const parts = rs.filter((r) => r.tax > 0).map((r) => `勤続${r.years}年なら税金約${man1(r.tax)}万円で手取り約${man1(r.net)}万円`);
  const zero = rs.filter((r) => r.tax === 0);
  if (zero.length) parts.push(`勤続${zero.map((r) => r.years + "年").join("・")}なら退職所得控除の範囲内なので税金0円、${amountMan.toLocaleString("ja-JP")}万円がそのまま手取り`);
  return `退職金${amountMan.toLocaleString("ja-JP")}万円の場合、${parts.join("、")}です(「退職所得の受給に関する申告書」を提出した一般の従業員の概算)。`;
}

function writeArticle() {
  const p = path.join(__dirname, "..", "articles", "taishokukin-tedori.html");
  let art = fs.readFileSync(p, "utf8");
  const gens = { net: tableHTML("net"), tax: tableHTML("tax") };
  for (const a of Object.keys(CASES)) { gens[`case-${a}`] = caseTableHTML(+a); gens[`s-${a}`] = caseSentence(+a); }
  for (const [name, body] of Object.entries(gens)) {
    const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
    if (!re.test(art)) throw new Error(`マーカーが無い: gen:${name}`);
    art = art.replace(re, (_, a, b) => `${a}\n${body}\n${b}`);
  }
  // FAQPage JSON-LD: 金額別の3問を先頭に（既にあれば答えを更新）
  art = art.replace(/(<script type="application\/ld\+json">\s*)(\{[^<]*?"@type":\s*"FAQPage"[^<]*?\})(\s*<\/script>)/, (_, a, json, c) => {
    const d = JSON.parse(json);
    const qs = Object.keys(CASES).map((k) => ({ "@type": "Question", name: caseQuestion(+k), acceptedAnswer: { "@type": "Answer", text: caseSentence(+k) } }));
    const names = new Set(qs.map((q) => q.name));
    d.mainEntity = [...qs, ...d.mainEntity.filter((q) => !names.has(q.name))];
    const body = d.mainEntity.map((q) => "    " + JSON.stringify(q)).join(",\n");
    return `${a}{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n${body}\n  ]\n}${c}`;
  });
  fs.writeFileSync(p, art);
  console.log("書き込み完了: articles/taishokukin-tedori.html");
}

function main() {
  const arg = process.argv[2];
  if (arg === "--write") return writeArticle();
  if (arg === "--html") {
    console.log("<!-- 手取り -->\n" + tableHTML("net") + "\n<!-- 税金合計 -->\n" + tableHTML("tax"));
    for (const a of Object.keys(CASES)) console.log(`<!-- ${a}万円 -->\n${caseSentence(+a)}\n${caseTableHTML(+a)}`);
    return;
  }
  if (arg === "--check") {
    const art = fs.readFileSync(path.join(__dirname, "..", "articles", "taishokukin-tedori.html"), "utf8");
    const want = [tableHTML("net"), tableHTML("tax"), ...Object.keys(CASES).flatMap((a) => [caseTableHTML(+a), caseSentence(+a)])];
    const ng = want.filter((w) => !art.includes(w));
    // 同じ文が表示と JSON-LD の2か所にあること
    for (const a of Object.keys(CASES)) {
      if (art.split(caseSentence(+a)).length - 1 < 2) ng.push(`金額別の文が表示と JSON-LD の2か所に無い: ${a}万円`);
      if (art.split(caseQuestion(+a)).length - 1 < 2) ng.push(`金額別の問いが h3 と JSON-LD の2か所に無い: ${a}万円`);
    }
    if (ng.length) { console.error("不一致:\n" + ng.join("\n---\n")); process.exit(1); }
    console.log("OK: 記事内の表5枚・金額別の文3つ（表示とJSON-LD）が再計算結果と一致");
    return;
  }

  console.log("== 手取り（万円） ==");
  console.log(["勤続", "控除", ...AMOUNTS_MAN].join("\t"));
  for (const y of YEARS) console.log([y + "年", manInt(kojoYen(y)), ...AMOUNTS_MAN.map((a) => man1(calc(a * 10000, y).net))].join("\t"));
  console.log("\n== 税金合計（万円） ==");
  for (const y of YEARS) console.log([y + "年", manInt(kojoYen(y)), ...AMOUNTS_MAN.map((a) => man1(calc(a * 10000, y).tax))].join("\t"));

  console.log("\n== 金額別ケース ==");
  for (const a of Object.keys(CASES)) {
    console.log(`${a}万円: ${caseSentence(+a)}`);
    for (const y of CASES[a]) { const r = calc(a * 10000, y); console.log(`  勤続${y}年 控除${manInt(r.kojo)}万 課税${manInt(r.taxable)}万 税率${r.rate}% 所得税${yen(r.shotoku)} 住民税${yen(r.jumin)} 合計${yen(r.tax)} 手取り${yen(r.net)} (${pct1(r.net / r.amountYen)}%)`); }
  }

  console.log("\n== index.html のツール（calcTaishokukin を抽出して実行）との突き合わせ ==");
  let diff = 0;
  for (const y of [...YEARS, 38]) for (const a of AMOUNTS_MAN) {
    const mine = calc(a * 10000, y).net / 10000;
    const tool = toolNetMan(a, y);
    const d = Math.abs(mine - tool);
    if (d >= 0.05) { diff++; console.log(`  差あり 勤続${y}年・${a}万円: 本スクリプト ${mine.toFixed(4)}万 / ツール ${tool.toFixed(4)}万 (差 ${(mine - tool).toFixed(4)}万)`); }
  }
  console.log(diff ? `  → ${diff}セルで0.05万円以上の差` : "  → 全セルで差は0.05万円未満（ツールの表示桁=0.1万円では同じ値）");

  console.log("\n== 国税庁の計算例での自己検査 ==");
  const t1 = calc(8000000, 11), t2 = calc(23000000, 30);
  console.log(`  No.2732 例1 (800万・11年) 所得税 ${t1.shotoku} 期待 91890 → ${t1.shotoku === 91890 ? "OK" : "NG"}`);
  console.log(`  No.2732 例2 (2,300万・30年) 所得税 ${t2.shotoku} 期待 380322 → ${t2.shotoku === 380322 ? "OK" : "NG"}`);
  const base = (7000000 * 23) / 100 - 636000;
  console.log(`  別紙の注 (課税700万) ${Math.floor((base * 1021) / 1000)} 期待 994454 → ${Math.floor((base * 1021) / 1000) === 994454 ? "OK" : "NG"}`);
  if (t1.shotoku !== 91890 || t2.shotoku !== 380322) process.exit(1);
}
main();
