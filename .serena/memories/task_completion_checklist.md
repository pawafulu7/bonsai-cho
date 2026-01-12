# タスク完了チェックリスト

## コード変更後

1. **型チェック**
   ```bash
   pnpm check
   ```

2. **Lint & Format**
   ```bash
   pnpm lint:fix
   pnpm format
   ```

3. **テスト実行**
   ```bash
   pnpm test:run
   ```

4. **ビルド確認**
   ```bash
   pnpm build
   ```

## DB変更後

1. マイグレーション生成
   ```bash
   pnpm db:generate
   ```

2. マイグレーション適用
   ```bash
   pnpm db:push
   ```

3. シードデータ更新（必要に応じて）
   ```bash
   pnpm db:seed
   ```

## PR作成前

1. 全チェック通過確認
2. 変更内容のセルフレビュー
3. CLAUDE.md の更新（構造変更時）
4. Serenaメモリの更新（大きな変更時）

## コミットメッセージ

```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント
style: フォーマット
test: テスト
chore: その他

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
