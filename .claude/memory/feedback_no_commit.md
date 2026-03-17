---
name: no-auto-commit
description: Do not commit unless the user explicitly asks to commit
type: feedback
---

Do not create git commits unless the user explicitly asks to commit.

**Why:** User prefers to control when commits happen. They rejected an auto-commit during subagent-driven development.

**How to apply:** During implementation workflows (subagent-driven dev, plan execution, etc.), skip all commit steps. Just implement, test, and move on. Let the user decide when to commit.
