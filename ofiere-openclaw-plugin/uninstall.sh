#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════════════════════╗
# ║  Ofiere PM Plugin — Uninstaller                                      ║
# ║  Removes the Ofiere plugin from OpenClaw cleanly.                    ║
# ╚═══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Ofiere PM Plugin — Uninstalling...          ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ── Flags ─────────────────────────────────────────────────────────────────────

NO_RESTART=false
for arg in "$@"; do
  case "$arg" in
    --no-restart) NO_RESTART=true ;;
  esac
done

# ── Detect OpenClaw home ─────────────────────────────────────────────────────

detect_openclaw_home() {
  if [[ -d "/data/.openclaw" ]]; then
    echo "/data/.openclaw"
  elif [[ -d "$HOME/.openclaw" ]]; then
    echo "$HOME/.openclaw"
  elif [[ -d "/opt/openclaw/.openclaw" ]]; then
    echo "/opt/openclaw/.openclaw"
  else
    echo ""
  fi
}

OPENCLAW_HOME=$(detect_openclaw_home)
if [[ -z "$OPENCLAW_HOME" ]]; then
  echo "  ✗ Could not find OpenClaw home directory"
  echo "    Checked: /data/.openclaw, $HOME/.openclaw, /opt/openclaw/.openclaw"
  exit 1
fi

PLUGIN_DIR="$OPENCLAW_HOME/extensions/ofiere"
ENV_FILE="$OPENCLAW_HOME/.env"
CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"

echo "  OpenClaw Home:  $OPENCLAW_HOME"
echo ""

# ── Step 1: Remove plugin directory ──────────────────────────────────────────

echo "→ Removing plugin files..."

if [[ -d "$PLUGIN_DIR" ]]; then
  rm -rf "$PLUGIN_DIR"
  echo "  ✓ Removed $PLUGIN_DIR"
else
  echo "  ℹ Plugin directory not found (already removed)"
fi

# ── Step 2: Remove environment variables ─────────────────────────────────────

echo "→ Cleaning environment variables..."

if [[ -f "$ENV_FILE" ]]; then
  # Remove OFIERE_* lines and the comment block
  grep -v '^OFIERE_' "$ENV_FILE" | grep -v '^# Ofiere Plugin' > "${ENV_FILE}.tmp" || true
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  echo "  ✓ Removed OFIERE_* vars from .env"
else
  echo "  ℹ No .env file found"
fi

# ── Step 3: Unregister from openclaw.json ────────────────────────────────────

echo "→ Removing from OpenClaw config..."

if [[ -f "$CONFIG_FILE" ]] && command -v node > /dev/null 2>&1; then
  UNREGISTER_RESULT=$(node -e "
    const fs = require('fs');
    const p = '$CONFIG_FILE';
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));

    let changed = false;

    // Remove from plugins.allow
    if (c.plugins && c.plugins.allow && c.plugins.allow.includes('ofiere')) {
      c.plugins.allow = c.plugins.allow.filter(x => x !== 'ofiere');
      changed = true;
    }

    // Remove from plugins.entries
    if (c.plugins && c.plugins.entries && c.plugins.entries.ofiere) {
      delete c.plugins.entries.ofiere;
      changed = true;
    }

    // Remove from tools.allow
    if (c.tools && c.tools.allow && c.tools.allow.includes('ofiere')) {
      c.tools.allow = c.tools.allow.filter(x => x !== 'ofiere');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(p, JSON.stringify(c, null, 2) + String.fromCharCode(10));
      console.log('UNREGISTERED');
    } else {
      console.log('NOT_REGISTERED');
    }
  " 2>&1) || true

  if [[ "$UNREGISTER_RESULT" == "UNREGISTERED" ]]; then
    echo "  ✓ Removed 'ofiere' from plugins.allow, plugins.entries, and tools.allow"
  elif [[ "$UNREGISTER_RESULT" == "NOT_REGISTERED" ]]; then
    echo "  ℹ Plugin was not registered in config"
  else
    echo "  ⚠ Could not update openclaw.json: $UNREGISTER_RESULT"
  fi
else
  echo "  ℹ Skipping config update (no openclaw.json or node not found)"
fi

# ── Step 4: Restart gateway ──────────────────────────────────────────────────

if [[ "$NO_RESTART" == "true" ]]; then
  echo ""
  echo "  ℹ Skipping restart (--no-restart flag)"
  echo "  → Restart manually: openclaw gateway restart"
else
  echo "→ Restarting OpenClaw gateway..."

  RESTARTED=false

  # Try Docker
  if command -v docker &>/dev/null; then
    CONTAINER_ID=$(docker ps --filter "name=openclaw" --format "{{.ID}}" 2>/dev/null | head -1)
    if [[ -z "$CONTAINER_ID" ]]; then
      CONTAINER_ID=$(docker ps --format "{{.ID}} {{.Image}}" 2>/dev/null | grep -i "openclaw" | awk '{print $1}' | head -1)
    fi
    if [[ -n "$CONTAINER_ID" ]]; then
      docker restart "$CONTAINER_ID" >/dev/null 2>&1 && RESTARTED=true
      if [[ "$RESTARTED" == "true" ]]; then
        echo "  ✓ Docker container restarted ($CONTAINER_ID)"
      fi
    fi
  fi

  # Try native CLI
  if [[ "$RESTARTED" == "false" ]] && command -v openclaw &>/dev/null; then
    openclaw gateway restart 2>/dev/null && RESTARTED=true
    if [[ "$RESTARTED" == "true" ]]; then
      echo "  ✓ Gateway restarted via CLI"
    fi
  fi

  # Try systemctl
  if [[ "$RESTARTED" == "false" ]] && command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet openclaw 2>/dev/null; then
      sudo systemctl restart openclaw 2>/dev/null && RESTARTED=true
      if [[ "$RESTARTED" == "true" ]]; then
        echo "  ✓ Gateway restarted via systemctl"
      fi
    fi
  fi

  if [[ "$RESTARTED" == "false" ]]; then
    echo "  ⚠ Could not auto-restart. Please restart manually:"
    echo "    • Docker: docker restart <container>"
    echo "    • Native: openclaw gateway restart"
    echo "    • Systemd: sudo systemctl restart openclaw"
  fi
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   ✓ Ofiere PM Plugin Uninstalled!             ║"
echo "║                                               ║"
echo "║   The plugin has been completely removed.     ║"
echo "║   You can re-install it anytime from Settings.║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
