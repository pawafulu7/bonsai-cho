# Bonsai-Cho 推奨コマンド

## 開発

```bash
pnpm dev          # 開発サーバー起動 (http://localhost:4321)
pnpm build        # 本番ビルド
pnpm preview      # ビルド結果プレビュー
```

## コード品質

```bash
pnpm lint         # Biome lint チェック
pnpm lint:fix     # Biome lint 自動修正
pnpm format       # Biome フォーマット
pnpm check        # Astro & TypeScript 型チェック
```

## テスト

```bash
pnpm test         # Vitest 監視モード
pnpm test:run     # Vitest 単発実行
```

## データベース

```bash
pnpm db:generate  # マイグレーション生成
pnpm db:push      # スキーマをDBにプッシュ
pnpm db:migrate   # マイグレーション適用
pnpm db:studio    # Drizzle Studio起動
pnpm db:seed      # シードデータ投入
```

## Git操作

```bash
git status        # 変更確認
git diff          # 差分確認
git add .         # 全ファイルステージング
git commit -m "message"  # コミット
git push origin branch   # プッシュ
```

## 環境変数

必要な環境変数（.env）:
- `TURSO_DATABASE_URL` - Turso接続URL
- `TURSO_AUTH_TOKEN` - Turso認証トークン
- `PUBLIC_APP_URL` - アプリケーションURL

## Cloudflare

```bash
npx wrangler pages dev dist  # ローカルでPages動作確認
npx wrangler pages deploy dist  # デプロイ
```
