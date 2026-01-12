# Bonsai-Cho 最近の改善 (2026-01)

## 2026-01-12: Phase 1 基盤構築完了

### PR #1: Initial Setup

**概要**: プロジェクト初期セットアップ

**主な実装**:
- Astro 5 + React 19 + Tailwind CSS 4 セットアップ
- Hono 4 APIフレームワーク統合
- Drizzle ORM + Turso データベーススキーマ
- Zod 環境変数バリデーション
- shadcn/ui コンポーネント
- 和モダンデザインテーマ
- ランディングページ

**セキュリティ改善**:
- CORS `origin: "*"` → 環境別動的allowlist
- `TURSO_AUTH_TOKEN` 空文字チェック追加

**Cloudflare Workers対応**:
- `process.env` → Hono `c.env` に変更
- 環境変数の本番キャッシュ最適化

**React 19対応**:
- `forwardRef` パターン → `ref` as prop パターン

**Biome 2.x対応**:
- Astro ファイルの誤検出回避設定
- スキーマ2.3.11にアップデート

---

## 次の予定

### Phase 2: 認証
- Arctic による OAuth 実装（GitHub, Google）
- セッション管理

### Phase 3: 画像
- Cloudflare R2 統合
- 画像アップロード・最適化

### Phase 4: API実装
- 盆栽CRUD API
- お手入れログAPI

### Phase 5: ソーシャル
- いいね機能
- コメント機能
- フォロー機能
