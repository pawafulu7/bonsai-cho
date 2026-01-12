# Bonsai-Cho コーディング規約

## 一般

- TypeScript strict mode 使用
- Biome による Lint & Format
- 関数は小さく、単一責任に
- TODOコメント禁止（完全実装）

## ファイル命名

- コンポーネント: PascalCase (`Button.tsx`)
- ユーティリティ: camelCase (`utils.ts`)
- 定数: SCREAMING_SNAKE_CASE
- スキーマ: camelCase (`bonsai.ts`)

## React コンポーネント

- 関数コンポーネントのみ使用
- Props は interface で定義
- React 19: forwardRef 不要（ref as prop）
- client:load, client:visible など適切なディレクティブを使用

```tsx
// Good: React 19 スタイル
function Input({ ref, ...props }: React.ComponentProps<"input">) {
  return <input ref={ref} {...props} />;
}
```

## API (Hono)

- ルートは `src/server/app.ts` に配置
- Zod でリクエスト/レスポンスをバリデーション
- エラーは適切なHTTPステータスコードで返す
- Cloudflare Workers環境では `c.env` を使用（`process.env` は使用不可）

## データベース (Drizzle)

- スキーマは `src/lib/db/schema/` に配置
- テーブル名は複数形 (`users`, `bonsai`)
- カラム名は camelCase
- マイグレーションは drizzle-kit で管理

## 環境変数

- Zodで検証（`src/lib/env.ts`）
- 本番環境ではモジュールロード時にキャッシュ
- 開発環境では毎回検証（ホットリロード対応）

## Tailwind CSS 4

- `@theme` ディレクティブでデザイントークン定義
- `global.css` にカスタムテーマ
- shadcn/ui との互換性を維持

## インポート順序

1. 外部ライブラリ
2. 内部モジュール（`@/`エイリアス使用）
3. 型インポート（`import type`）

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "@/lib/env";
import { parseEnv } from "@/lib/env";
```
