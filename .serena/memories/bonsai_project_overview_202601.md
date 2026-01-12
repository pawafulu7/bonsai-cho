# Bonsai-Cho プロジェクト概要

## 概要
盆栽愛好家のための画像共有プラットフォーム。
自分の盆栽コレクションを記録・共有し、他の愛好家と交流できるサービス。

## 技術スタック

### Frontend
- **Astro 5.x** - メタフレームワーク
- **React 19.x** - インタラクティブIslands
- **TypeScript 5.x** - 型安全
- **Tailwind CSS 4.x** - スタイリング
- **shadcn/ui** - UIコンポーネント

### Backend (API)
- **Hono 4.x** - APIフレームワーク（Cloudflare Workers対応）
- **Drizzle ORM** - 型安全ORM
- **Zod** - バリデーション

### Database & Storage
- **Turso** - メインDB (libSQL/SQLite Edge)
- **Cloudflare R2** - 画像ストレージ（予定）

### Infrastructure
- **Cloudflare Pages** - フロントエンドホスティング
- **Cloudflare Workers** - API実行環境

### Development Tools
- **pnpm** - パッケージ管理
- **Biome 2.x** - Linter & Formatter
- **Vitest** - テスト

## ディレクトリ構成

```
bonsai/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui
│   │   ├── astro/       # Astroコンポーネント (Header, Footer)
│   ├── pages/
│   │   └── api/         # Honoルートエントリポイント
│   ├── server/          # Hono APIアプリケーション
│   ├── lib/
│   │   ├── db/          # Drizzle スキーマ・クライアント
│   │   │   └── schema/  # テーブル定義 (bonsai, users, masters)
│   │   ├── env.ts       # 環境変数バリデーション
│   │   └── utils.ts     # ユーティリティ
│   ├── layouts/         # Astroレイアウト
│   └── styles/          # グローバルCSS（Tailwind 4 @theme）
├── drizzle/             # マイグレーションファイル
├── public/
└── 設定ファイル
```

## デザインコンセプト

### カラーパレット（和モダン）
- **Primary**: #2D5A3D (深緑/常磐色)
- **Accent**: #C77B4A (茶/柿色)
- **Background**: #FAF8F5 (生成り)

### デザイン方針
- 和モダン: 伝統的な盆栽の世界観 + 現代的なUI
- 余白を活かしたクリーンなレイアウト
- 画像が主役
- モバイルファースト

## 現在の実装状況 (2026-01)

### Phase 1 完了
- [x] プロジェクト基盤構築
- [x] Astro 5 + React 19 + Tailwind CSS 4 セットアップ
- [x] Hono APIフレームワーク統合
- [x] Drizzle ORM + Turso スキーマ定義
- [x] Zodによる環境変数バリデーション
- [x] Biome 2.x リンター設定
- [x] ランディングページ

### 今後の予定
- Phase 2: 認証（OAuth）
- Phase 3: 画像アップロード (R2)
- Phase 4: API実装
- Phase 5: ソーシャル機能
