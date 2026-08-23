#!/bin/bash
# Warns when puzzle/engine work exists locally but is not on origin/main.
# This project deploys from origin/main; a clean-looking working tree has twice
# hidden a finished puzzle batch that players never received.
cd "$CLAUDE_PROJECT_DIR" || exit 0

unshipped=$(git status --porcelain -- puzzles engines app.js index.html 2>/dev/null)
unpushed=$(git log --oneline origin/main..main 2>/dev/null)

[ -z "$unshipped" ] && [ -z "$unpushed" ] && exit 0

{
  echo "PUZZLES NOT LIVE — this project deploys from origin/main."
  [ -n "$unshipped" ] && printf 'Uncommitted or untracked:\n%s\n' "$unshipped"
  [ -n "$unpushed" ] && printf 'Committed but unpushed:\n%s\n' "$unpushed"
  echo "Do not report puzzle work as finished. Commit and push, then re-verify"
  echo "that origin/main..main is empty. See the verify-the-push memory."
} >&2
exit 2
