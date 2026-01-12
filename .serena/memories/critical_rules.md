# 重要ルール（毎セッション必読）

## 1. CodexMCP
- 問題・判断時は即座に相談
- **modelパラメータは指定しない**（デフォルトを使用、o3等のモデル指定は禁止）

## 2. エージェント自動呼び出し
| 条件 | エージェント | フェーズ |
|------|-------------|---------|
| 100行↑変更 or 3ファイル↑ | refactoring-expert | plan/impl |
| セキュリティ | security-engineer | 全 |
| パフォーマンス | performance-engineer | 全 |
| 原因不明バグ | root-cause-analyst | 全 |
| UI/UX調査・設計 | frontend-architect | inv/plan |
| UI/UX実装 | frontend-design-system-implementer | impl |
| テスト戦略 | quality-engineer | plan/impl |
| 要件定義 | requirements-analyst | inv/plan |

## 3. コンテキスト節約
- 探索3ステップ↑ → `Task(subagent_type='Explore')`
- 新規UI → スキル `frontend-skills:frontend-design-system`

## 理由
サブエージェント=別コンテキスト=メイン節約+専門分析
