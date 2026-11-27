#!/bin/sh
# 脱离 dsh 自身进程树重启 DSH，重启后自检并跑 dsh-pet 浏览器验收。
# 用法：systemd-run --on-active=30 --unit=dsh-restart-<ts> --collect \
#          --property=TimeoutStartSec=1200 /bin/sh /opt/dsh/dsh-pet/scripts/restart-verify.sh
# 结果写 /opt/dsh/dsh-pet/state/restart-<ts>.{log,md}
set -u

# 仓库根按脚本位置推导；家目录与 dsh-ext 也不写死（本机工具，可用 DSH_EXT 覆盖）。
PET_DIR=$(cd "$(dirname "$0")/.." && pwd)
STATE_DIR=$PET_DIR/state
HOME_DIR=${HOME:-$(cd ~ && pwd)}
DSH_EXT=${DSH_EXT:-$HOME_DIR/.local/bin/dsh-ext}
UNIT=deepseek-harness.service
TS=$(date +%Y%m%d-%H%M%S)
LOG=$STATE_DIR/restart-$TS.log
MD=$STATE_DIR/restart-$TS.md
mkdir -p "$STATE_DIR"

exec >>"$LOG" 2>&1
say() { printf '%s\n' "· $*"; }

echo "== dsh-pet restart-and-verify $TS =="
BEFORE=$(dsh --version 2>/dev/null || echo unknown)
say "重启前 dsh 版本：$BEFORE"

systemctl restart "$UNIT"
say "已发起重启，等待 3080/3081 就绪…"

waited=0
while [ "$waited" -lt 180 ]; do
  if curl -s -o /dev/null --max-time 2 http://127.0.0.1:3080/ \
     && curl -s -o /dev/null --max-time 2 http://127.0.0.1:3081/gateway/login; then
    break
  fi
  waited=$((waited + 1))
  sleep 1
done
say "端口就绪用时：${waited}s"
sleep 3

ACTIVE=$(systemctl is-active "$UNIT" 2>/dev/null || echo unknown)
AFTER=$(dsh --version 2>/dev/null || echo unknown)
PATCH=$("$DSH_EXT" patch 2>/dev/null | tr '\n' ' ')
say "服务状态：$ACTIVE"
say "重启后 dsh 版本：$AFTER"
say "内核补丁：$PATCH"

# 客户端插件图里不该再有已卸载的插件
TOKEN=$(journalctl -u "$UNIT" --no-pager -o cat 2>/dev/null \
  | grep -o 'token=[A-Za-z0-9_-]*' | tail -1 | sed 's/token=//')
CODE_X=$(curl -sL -c /tmp/dsh-restart-jar -b /tmp/dsh-restart-jar \
  "http://127.0.0.1:3080/?token=$TOKEN" 2>/dev/null \
  | grep -c '@michengai/dsh-codex-pet')
PET_X=$(curl -sL -c /tmp/dsh-restart-jar -b /tmp/dsh-restart-jar \
  "http://127.0.0.1:3080/?token=$TOKEN" 2>/dev/null | grep -c 'dsh-pet/client.js')
say "客户端图：dsh-pet 引用 $PET_X 处，codex-pet 残留 $CODE_X 处"
rm -f /tmp/dsh-restart-jar

# host 半自检：活动流 / 日记 / 图集 / pet_say 是否都挂上了
STATUS_JSON=$(curl -s --max-time 5 http://127.0.0.1:3080/pet/status 2>/dev/null || echo '{}')
ACTIVITY_JSON=$(curl -s --max-time 5 'http://127.0.0.1:3080/pet/activity?after=0' 2>/dev/null || echo '{}')
DIARY_JSON=$(curl -s --max-time 5 'http://127.0.0.1:3080/pet/diary?lang=zh' 2>/dev/null || echo '{}')
SKINS_JSON=$(curl -s --max-time 5 http://127.0.0.1:3080/pet/skins 2>/dev/null || echo '{}')
say "status: $STATUS_JSON"
say "activity: $(printf '%s' "$ACTIVITY_JSON" | head -c 400)"
say "diary: $(printf '%s' "$DIARY_JSON" | head -c 400)"
say "skins: $(printf '%s' "$SKINS_JSON" | head -c 200)"

HOST_OK=1
printf '%s' "$STATUS_JSON" | grep -q '"sayTool"' || HOST_OK=0
printf '%s' "$ACTIVITY_JSON" | grep -q '"seq"' || HOST_OK=0
printf '%s' "$DIARY_JSON" | grep -q '"lines"' || HOST_OK=0
printf '%s' "$SKINS_JSON" | grep -q '"skins"' || HOST_OK=0
say "host 半接口自检：$([ "$HOST_OK" -eq 1 ] && echo 全部就绪 || echo 有缺失)"

cd "$PET_DIR" || exit 1
node scripts/verify-ui.mjs --out docs/verification/pet
RC=$?
say "浏览器验收 exit=$RC"
tail -3 docs/verification/pet/verify-ui.json 2>/dev/null || true
[ "$HOST_OK" -eq 1 ] || RC=1

cat >"$MD" <<EOF
# DSH 重启 + dsh-pet 验收（$TS）

- dsh 版本：$BEFORE → $AFTER
- 服务状态：$ACTIVE，端口就绪用时 ${waited}s
- 内核补丁：$PATCH
- 客户端图：dsh-pet 引用 $PET_X 处，已卸载的 codex-pet 残留 $CODE_X 处（0 = 已清干净）
- host 半接口（/pet/status、/pet/activity、/pet/diary、/pet/skins）：$([ "$HOST_OK" -eq 1 ] && echo 全部就绪 || echo 有缺失)
- 浏览器验收：exit=$RC（0 = 全部断言通过），报告 \`docs/verification/pet/verify-ui.json\`
- 活动流快照：\`$(printf '%s' "$ACTIVITY_JSON" | head -c 300)\`
- 日记短句：\`$(printf '%s' "$DIARY_JSON" | head -c 300)\`
- 完整日志：\`$LOG\`
EOF
say "摘要写入 $MD"
[ "$RC" -eq 0 ] && say "结论：重启后一切正常" || say "结论：验收失败，请看上方日志"
exit "$RC"
