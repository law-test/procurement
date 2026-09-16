"""Refresh only the generated rules block in supabase/ranking.sql.

Rules are stored by immutable revision: bump the game's revision before changing
scoring rules already installed in a database. No user data is generated here.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "supabase" / "ranking.sql"
START = "-- BEGIN GENERATED RANKING RULES"
END = "-- END GENERATED RANKING RULES"
STORY_REVISION = "20260916-1"


def generate():
    rules = []
    for role in ("supplier", "manager"):
        raw = json.loads((ROOT / "data" / f"story-{role}.json").read_text(encoding="utf-8"))
        nodes = {}
        for n in raw["nodes"]:
            node = {"choices": {c["id"]: {k: c[k] for k in ("next", "delta", "requires", "setFlags") if k in c} for c in n["choices"]}}
            if n.get("ending"):
                node["ending"] = {k: n["ending"][k] for k in ("id", "title")}
            nodes[n["id"]] = node
        rules.append((role, STORY_REVISION, {"start": raw["start"], "nodes": nodes}))
    raw = json.loads((ROOT / "data" / "learning-reviewed.json").read_text(encoding="utf-8"))
    mini = {"atoms": [a["id"] for a in raw["atoms"]], "questions": {q["id"]: {"atom": q["atom_id"], "answer": q["answer_index"], "options": len(q["options"])} for q in raw["questions"]}}
    assert len(mini["atoms"]) == len(set(mini["atoms"])) == 6
    for mode in ("combo", "combo-free", "mission", "match"):
        rules.append((mode, raw["package_id"], mini))
    rows = []
    for mode, revision, rule in rules:
        payload = json.dumps(rule, ensure_ascii=False, separators=(",", ":")).replace("'", "''")
        rows.append(f"('{mode}', '{revision}', '{payload}'::jsonb)")
    values = ",\n".join(rows)
    block = f"""{START}
INSERT INTO public.jp_rank_rules(mode, revision, rules)
VALUES {values}
ON CONFLICT (mode, revision) DO NOTHING;
DO $verify_seed$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES {values}) AS expected(mode,revision,rules)
    JOIN public.jp_rank_rules actual USING (mode,revision)
    WHERE actual.rules IS DISTINCT FROM expected.rules
  ) THEN RAISE EXCEPTION 'A published ranking revision is immutable. Bump the game revision first.'; END IF;
END
$verify_seed$;
{END}"""
    text = SQL.read_text(encoding="utf-8")
    assert text.count(START) == text.count(END) == 1
    before, rest = text.split(START)
    _, after = rest.split(END)
    SQL.write_text(before + block + after, encoding="utf-8", newline="\n")
    print(f"Updated {len(rules)} immutable ranking rule sets in {SQL}")


if __name__ == "__main__":
    generate()
