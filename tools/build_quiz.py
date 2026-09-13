#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom 원장에서 객관식 문항을 만든다.

정답이 하나로 확정되는 두 유형만 만든다.
  num : 문장 속 숫자·요율·기간을 괄호로 가리고 값을 고르게 한다.
        오답은 같은 단위에서 값만 바꾸므로 반드시 틀린 선지가 된다.
  art : 내용의 근거 조문을 고르게 한다.
        오답은 같은 법령의 다른 조문에서 뽑는다.

서술형 4지선다(옳은 설명 고르기)는 오답이 정말 틀렸는지 사람이 검수해야 하므로
여기서 자동 생성하지 않는다.
"""
import json, os, re, random, collections

BUILD = os.environ.get("PPM_BUILD", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "_private", "build"))
OUT = os.environ.get("PPM_OUT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SUBJ_SLUG = {
    "공공조달과 법제도 이해": "law",
    "공공조달계획 수립 및 분석": "plan",
    "공공계약관리": "contract",
    "공공조달 관리실무": "practice",
}
CRIT_SUBJ = {}   # 기준ID → 과목

# 값이 바뀌면 반드시 틀리는 단위만 고른다. '개', '차원' 같은 세는 말은 제외.
UNIT = r"(퍼센트|%|％|억원|만원|천원|원|일|개월|년간|년|회|명|분|시간|배|분의\s?\d+|천분의\s?\d+|백분의\s?\d+)"
NUM = re.compile(r"(?<![\d.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*" + UNIT)
LAWNAME = r"(?:「[^」]{2,30}」|국가계약법|지방계약법|판로지원법|전자조달법|조달사업법|행정기본법|형법|국가재정법|중소기업제품\s*구매촉진법|소프트웨어진흥법)"
ART = re.compile(r"(" + LAWNAME + r"?\s*(?:시행령|시행규칙)?\s*제\s?\d+조(?:의\d+)?(?:\s?제\d+항)?(?:\s?제\d+호)?)")
ART_LAW = re.compile(r"(" + LAWNAME + r")")


def fmt(v, unit):
    if unit == "년" and v >= 1900:
        return "%d년" % int(v)
    if v == int(v):
        s = "{:,}".format(int(v))
    else:
        s = ("%.1f" % v).rstrip("0").rstrip(".")
    return s + unit


def num_distractors(val, unit):
    """같은 단위에서 값만 바꾼 오답. 중복·음수·0은 버린다."""
    if unit == "년" and val >= 1900:          # 연도는 배수로 흔들면 말이 안 된다
        out = []
        for d in (1, 2, 3, 4):
            for c in (val - d, val + d):
                if c not in out and c != val:
                    out.append(c)
                if len(out) == 3:
                    return [fmt(c2, unit) for c2 in out]
        return [fmt(c2, unit) for c2 in out[:3]]
    cands = []
    for f in (2, 0.5, 3, 1.5):
        cands.append(val * f)
    step = 1 if val < 10 else (5 if val < 100 else (10 if val < 1000 else 1000))
    cands += [val + step, val - step, val + step * 2]
    out, seen = [], {round(val, 3)}
    for c in cands:
        if c <= 0:
            continue
        c = round(c, 2)
        if c in seen:
            continue
        if val >= 10 and c != int(c):
            continue
        seen.add(c)
        out.append(fmt(c, unit))
        if len(out) == 3:
            break
    return out


def law_of(article):
    m = ART_LAW.search(article)
    return m.group(1) if m else ""


def build_items(atoms, crit_subj):
    num_items, art_items = [], []
    by_law = collections.defaultdict(set)
    for a in atoms:
        g = a.get("근거", "")
        for m in ART.finditer(g):
            t = re.sub(r"\s+", " ", m.group(1)).strip()
            if re.search(r"제\d+조", t):
                by_law[law_of(t)].add(t)

    for a in atoms:
        s = a.get("핵심 원리", "")
        aid = a.get("atom ID", "")
        subj = a.get("과목", "") or crit_subj.get((a.get("연결 기준 ID", "") or "").split(",")[0].strip(), "")
        if subj not in SUBJ_SLUG:
            continue
        base = {
            "atom": aid, "t": a.get("핵심 아이디어", ""), "subject": subj,
            "major": a.get("주요항목", ""), "minor": a.get("세부항목", ""),
            "imp": a.get("중요도", ""), "src": a.get("근거", ""),
            "cond": a.get("적용조건·예외", ""), "conf": a.get("혼동하기 쉬운 점", ""),
            "gid": (a.get("연결 기준 ID", "") or "").split(",")[0].strip(),
        }

        m = NUM.search(s)
        if m and len(s) > 25:
            around = s[max(0, m.start() - 1):m.start()] + s[m.end():m.end() + 1]
            if "~" in around or "∼" in around or "―" in around:
                m = None
        if m and len(s) > 25:
            val_s, unit = m.group(1), m.group(2)
            try:
                val = float(val_s.replace(",", ""))
            except ValueError:
                val = None
            if val and val > 0:
                ds = num_distractors(val, unit)
                if len(ds) == 3:
                    ans = fmt(val, unit)
                    stem = s[:m.start()] + "(  ㉠  )" + s[m.end():]
                    ch = ds + [ans]
                    random.shuffle(ch)
                    it = dict(base)
                    it.update({
                        "kind": "num",
                        "q": "다음 설명의 ㉠에 들어갈 것으로 옳은 것은?",
                        "stem": stem, "choices": ch, "answer": ch.index(ans),
                        "full": s,
                    })
                    num_items.append(it)

        mm = ART.search(a.get("근거", ""))
        if mm and re.search(r"제\d+조", mm.group(1)) and len(s) > 25:
            ans = re.sub(r"\s+", " ", mm.group(1)).strip()
            law = law_of(ans)
            if not law:
                continue
            pool = [x for x in by_law.get(law, ()) if x != ans]
            if len(pool) >= 3:
                stem2, nmask = ART.subn("(  \u3220  )", s)
                stem2 = re.sub(r"(?:\u300c[^\u300d]{2,30}\u300d|" + LAWNAME.replace("(?:", "").rstrip(")") + r")\s*(?:\uc2dc\ud589\ub839|\uc2dc\ud589\uaddc\uce59)?\s*\(  \u3220  \)", "(  \u3220  )", stem2)
                if nmask > 1 or len(re.sub(r"\s+", "", stem2)) < 22:
                    continue
                q = ("다음 설명의 \u3220에 해당하는 규정으로 옳은 것은?" if nmask
                     else "다음 내용의 근거 규정으로 옳은 것은?")
                ds = random.sample(pool, 3)
                ch = ds + [ans]
                random.shuffle(ch)
                it = dict(base)
                it.update({
                    "kind": "art",
                    "q": q,
                    "stem": stem2, "choices": ch, "answer": ch.index(ans), "full": s,
                })
                art_items.append(it)
    return num_items, art_items


def main():
    random.seed(20260913)
    atoms = json.load(open(os.path.join(BUILD, "atoms_v005.json"), encoding="utf-8"))
    crit = json.load(open(os.path.join(BUILD, "criteria273.json"), encoding="utf-8"))
    crit_subj = {c["id"]: c["subject"] for c in crit}

    num_items, art_items = build_items(atoms, crit_subj)

    # atom 하나당 문항 1개까지 — 같은 지식이 한 시험지에 두 번 나오지 않게
    chosen, seen = [], set()
    for it in num_items + art_items:
        if it["atom"] in seen:
            continue
        seen.add(it["atom"])
        chosen.append(it)

    by_sub = collections.defaultdict(list)
    for it in chosen:
        by_sub[it["subject"]].append(it)

    os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
    total = 0
    for subj, slug in SUBJ_SLUG.items():
        items = by_sub.get(subj, [])
        for i, it in enumerate(items):
            it["id"] = "%s-%04d" % (slug.upper(), i + 1)
        path = os.path.join(OUT, "data", "quiz.%s.json" % slug)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"subject": subj, "slug": slug, "n": len(items), "items": items},
                      f, ensure_ascii=False)
        kinds = collections.Counter(x["kind"] for x in items)
        print("  %-22s 문항 %4d  (숫자 %d · 규정 %d)" % (subj, len(items), kinds["num"], kinds["art"]))
        total += len(items)
    print("객관식 문항 %d개" % total)


if __name__ == "__main__":
    main()
