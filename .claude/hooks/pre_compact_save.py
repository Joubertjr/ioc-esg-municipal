#!/usr/bin/env python3
"""PreCompact: salva estado antes de compactar contexto."""
import json, os, subprocess, glob
from datetime import datetime

def run(cmd):
    try: return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10).stdout.strip()
    except: return ""

bdir = os.path.join(os.getcwd(), ".claude", "backups")
os.makedirs(bdir, exist_ok=True)

ts = datetime.now().strftime("%Y%m%d-%H%M%S")
parts = [f"# Backup Pre-Compact — {ts}\n"]
parts.append(f"Branch: {run('git branch --show-current')}\n")
log = run("git log --oneline -10")
if log: parts.append(f"## Commits\n```\n{log}\n```\n")
diff = run("git diff --stat")
if diff: parts.append(f"## Diff\n```\n{diff[:800]}\n```\n")

sf = os.path.join(os.getcwd(), "docs", "ESTADO_ATUAL_SC.md")
if os.path.exists(sf):
    with open(sf) as f: parts.append(f"## Estado\n{f.read()[:3000]}\n")

with open(os.path.join(bdir, f"compact-{ts}.md"), "w") as f:
    f.write("\n".join(parts))

# Mantém só últimos 15 backups
for old in sorted(glob.glob(os.path.join(bdir, "compact-*.md")))[:-15]:
    os.remove(old)

print(f"Backup salvo: compact-{ts}.md")
