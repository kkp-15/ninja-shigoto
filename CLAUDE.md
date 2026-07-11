# このリポの作業ルール（KKP共通）

このファイルはクラウドセッション（claude.ai/code）・Codex・ローカルAIエージェント共通の作業ルール。
正本はローカル統括セッションのメモリにあり、本ファイルはその要点の写し（配布 2026-07-11）。

- **デプロイ**: Cloudflare Pages＋`.github/workflows/deploy.yml`（push＝自動デプロイ）。**GitHub Pagesは使用禁止**（Pages設定・CNAMEファイル・gh-pagesブランチを作らない）
- **JSON-LDの`author.name`は「web忍者の砦」固定**。個人名は絶対に入れない
- **広告**（AdSense/アフィリエイト）は`<main>`最下部 or フッター手前のみ。上部・中間挿入は禁止。広告の新設・移動はユーザー確認必須
- **アフィリエイトは確認済み案件のみ**。存在しない案件・未提携のリンクを追加しない
- **titleタグ・og:titleは指示がない限り変更しない**
- **シェアUIはX・LINE・コピーの3ボタン**（https://kkpwebninja.com/shared/fortress-share.js）。**シェア文面・ハッシュタグは変更しない**
- GA4は`G-2LM85GJN0L`。これ以外の計測ID・秘匿IDをHTMLに埋めない
- APIキー・トークン・パスワードをコードに書かない
- **変更は最小限に**。既存の絵文字・文言・データ構造・URL構造を「改善」目的で勝手に変えない
- クラウド/リモート作業（claude.ai/code・Codex等）は**ブランチを切ってPRで提出**し、mainへ直接pushしない（ローカル統括セッションの直接指示がある場合を除く）。`.github/workflows/`・リポジトリシークレット・DNS/Cloudflare設定には触らない。マージは統括レビュー後

## このリポ固有の保護指定（ninja-shigoto / しごとの乗りかえ案内）

サイト: https://shigoto.kkpwebninja.com/

- **辞めどき診断の「残る」判定には広告・CTA・シェアを一切出さない**。サイトの信頼設計の核であり絶対に変えない
- 煽らない文体（「残る選択も尊重」「もらう前提で辞めない」）を維持する
- 単一HTML構成（`index.html`）。フレームワーク・ビルドツール・外部JSを導入しない。UIに絵文字を使わない
- URL・canonical・内部リンクは**拡張子なし**（例: `/articles/taishokukin-tedori`）。CF Pagesが`.html`をリダイレクトする
- `/articles/` 5記事の`<style>`は共通テンプレ。**変更する時は5記事すべてを揃える**
- 入力要素のidは計算関数が参照しているため変更不可
- 税率・制度の数値を更新したらフッターの「◯年◯月時点」表記も必ず更新する
- デプロイはgit push（GitHub Actions）経由のみ。`wrangler pages deploy`をローカル作業ディレクトリから直接実行しない
- 詳細な運用メモはローカル専用の`CLAUDE.local.md`（非公開・gitignore）にある。クラウド作業は本ファイルの範囲で行う
