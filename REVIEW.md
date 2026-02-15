# MindSight 公開運用コードレビュー

最終確認日: 2025年

## 実施した修正（今回）

### main.py
- 会話履歴の上限: セッションあたり最大40メッセージでトリム（メモリ枯渇防止）

### api/chat.py（Vercel）
- `user_input`: `min_length=1`, `max_length=4000` を追加
- CORS: `allow_credentials=False`（`*` と併用不可のため）
- APIキー未設定時: 503 と JSON でメッセージを返却
- `completion.choices` が空の場合のチェックを追加
- `raw` を try 外で初期化、`JSONDecodeError` を個別に捕捉
- `valence` / `arousal` をクランプ、`distortions` の型チェック
- エラー時に `internal_thinking` に内部エラーを返さない（`None`）
- `max_tokens=8000` に統一
- ログ: ユーザー発言内容は出さず `input_len` のみ

### js/main.js
- `session_id`: `sessionStorage` で生成・保持し、リクエストに付与（main.py の履歴分離に対応）
- 503/422 エラー時の `detail` を文字列 or 配列どちらでも正しく表示
- 入力欄に `maxlength=4000` を設定、文字数表示で 4000 文字で警告色
- `generateSessionSummary`: `m.meta` が無い場合の安全な参照

### index.html
- 「Analysis runs locally」→「AI analysis is processed securely on the server. Input limited to 4,000 characters.」に変更

---

## 公開運用チェックリスト

| 項目 | 状態 |
|------|------|
| 入力長制限（4000文字） | ✅ main / api 両方 |
| APIキー未設定時の挙動 | ✅ 503 + メッセージ |
| CORS（credentials と * の併用回避） | ✅ |
| エラー詳細をクライアントに返さない | ✅ |
| ログに個人発言を出さない | ✅ |
| 会話履歴のメモリ上限 | ✅ 40件/セッションでトリム |
| 静的ファイルの存在チェック | ✅ |
| ヘルスチェック /health | ✅ |
| .env を .gitignore に含める | ✅ |
| XSS 対策（escapeHtml） | ✅ フロントで実施 |

---

## 運用時の推奨事項

1. **レート制限**: 本番では `/v1/chat` に slowapi 等でリクエスト数制限を検討
2. **HTTPS**: リバースプロキシで TLS 終端
3. **HIPAA バッジ**: 実際に HIPAA 準拠でない場合は表記を変更または削除を検討
4. **Vercel**: 環境変数 `DEEPSEEK_API_KEY` をダッシュボードで設定
