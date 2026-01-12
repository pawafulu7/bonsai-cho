# Phase 1 基盤構築 実装記録 (2026-01)

## 実装概要

PR #1: Bonsai-Cho プロジェクトの初期セットアップ完了

## 実装内容

### 1. プロジェクト基盤

- **Astro 5.x** + **React 19.x** + **Tailwind CSS 4.x** セットアップ
- **Cloudflare Pages** アダプター設定
- **TypeScript** strict mode 設定
- **Biome 2.3.11** Linter/Formatter 設定（Astro対応含む）

### 2. APIフレームワーク

- **Hono 4.x** 統合（`src/server/app.ts`）
- Astro APIルートエントリポイント（`src/pages/api/[...route].ts`）
- CORS設定（環境に応じた動的allowlist）
- エラーハンドリング（本番/開発環境で詳細度切り替え）

### 3. データベース

- **Drizzle ORM** + **Turso (libSQL)** 接続
- スキーマ定義:
  - `users` - ユーザー（論理削除対応）
  - `sessions` - セッション管理
  - `bonsai` - 盆栽データ
  - `bonsaiImages` - 画像
  - `careLogs` - お手入れログ
  - `tags`, `bonsaiTags` - タグ（多対多）
  - `species`, `styles` - マスターデータ
- シードスクリプト（`src/lib/db/seed.ts`）

### 4. 環境変数管理

- **Zod** によるバリデーション（`src/lib/env.ts`）
- 本番環境でのキャッシュ最適化
- 開発環境では毎回検証（ホットリロード対応）

### 5. UIコンポーネント

- **shadcn/ui** ベースコンポーネント（button, card, input, label）
- React 19対応（forwardRef削除）
- 和モダンデザインテーマ（Tailwind CSS 4 @theme）

### 6. レイアウト

- `BaseLayout.astro` - 基本HTML構造
- `AppLayout.astro` - ヘッダー/フッター付きレイアウト
- ランディングページ（`src/pages/index.astro`）

## 変更されたファイル (35ファイル)

### 設定ファイル
- `package.json`, `pnpm-lock.yaml`
- `astro.config.mjs`, `tailwind.config.ts`, `tsconfig.json`
- `biome.json`, `vitest.config.ts`, `drizzle.config.ts`
- `wrangler.toml`, `.env.example`, `.gitignore`

### ソースコード
- `src/server/app.ts` - Hono APIアプリケーション
- `src/pages/api/[...route].ts` - APIルートハンドラ
- `src/lib/db/` - データベース関連
- `src/lib/env.ts` - 環境変数管理
- `src/components/` - UIコンポーネント
- `src/layouts/` - レイアウト
- `src/styles/global.css` - グローバルスタイル

## 技術的決定事項

### 1. CORS設定
- 開発: `localhost:4321`, `localhost:3000`, `127.0.0.1:4321` を許可
- 本番: `PUBLIC_APP_URL` のみ許可

### 2. 環境変数キャッシュ
- 本番環境のみキャッシュ（パフォーマンス最適化）
- 開発環境は毎回検証（設定変更の即時反映）

### 3. React 19 対応
- `forwardRef` パターン廃止
- `ref` を props として直接受け取る新パターン採用

### 4. Biome Astro対応
- `.astro` ファイルの `noUnusedVariables`, `noUnusedImports` をオフ
- テンプレート内使用変数の誤検出回避

## レビュー対応事項

- CORS `origin: "*"` → 動的allowlist化
- `process.env` → `c.env` (Cloudflare Workers対応)
- `TURSO_AUTH_TOKEN` に `.min(1)` 制約追加
- seed.ts で `parseEnv` を使用
- ログメッセージ「Inserted」→「Upserted」修正

## 今後の改善案

### Phase 2 以降
- HTTPException によるエラー分類
- drizzle-zod によるアプリケーション層バリデーション
- カウンター整合性保証ロジック（likeCount, commentCount）
- CLAUDE.md のディレクトリ構造記載更新
