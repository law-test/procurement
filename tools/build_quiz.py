#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
객관식 문항 생성기 — 공식 예시문항의 형식에 맞춘다.

근거로 삼은 것
  · 시행기관 공개 예시문항 6문항 (2026-02-13, Q-Net). 모두 4지선다.
    발문이 근거 규정을 먼저 밝히고("~법령상", "(계약예규) ~기준상"), 선지가 짧다.
  · 박문각 올큐패스 필기 객관식 504문항의 발문 분포.
    설명 판별 44% · 부정형 24% · 사례·순서 27% · 수치 3% · 조합형 2% · 괄호 0.2%
    발문 중위 34자 · 선지 중위 15자 · ⑤ 선지는 하나도 없음.

그래서 만드는 유형은 넷이다.
  term  〈보기〉의 설명에 해당하는 개념 고르기      (실제 44%를 차지하는 형태)
  notin 그 세부항목에 해당하지 않는 것 고르기       (부정형)
  value 법령이 정한 수치·기간·금액 고르기          (선지는 값만)
  combo ㄱㄴㄷ 중 옳은 것 모두 고르기

버린 것
  · 근거 조문을 고르게 하는 유형. 공식 예시문항과 올큐패스 504문항에 단 하나도 없다.
    실제 시험은 발문에서 근거 규정을 먼저 알려 주고 내용을 묻는다. 반대로 물으면 시험과 다르다.
  · atom의 핵심 원리(평균 121자)를 그대로 지문에 놓는 괄호형. 실제 선지·발문보다 훨씬 길다.

문항을 낼 atom의 범위
  올큐패스 실제 문항이 붙은 atom, 중요도 높음, 또는 유형이 수치·구별·예외인 것.
  나머지는 교재에서 읽기만 하고 문항으로 만들지 않는다.
"""
# 2026-09-16: 자동 생성물은 독립작성·선택지·법령 검수 없이 공개할 수 없다.
# 환경변수나 import로 우회하지 않도록 입출력보다 먼저 중단한다.
raise SystemExit(
    "중단: build_quiz.py는 검수 전 원장 기반 문항을 공개 data/에 쓰는 레거시 생성기입니다. "
    "출력 경로와 관계없이 실행하지 않습니다. 검수된 독립 작성 데이터의 흐름은 tools/README.md를 확인하세요."
)

import json, os, re, random, collections

BUILD = os.environ.get("PPM_BUILD", "/home/claude/build")
OUT = os.environ.get("PPM_OUT", "/home/claude/procurement")

SUBJ_SLUG = {
    "공공조달과 법제도 이해": "law",
    "공공조달계획 수립 및 분석": "plan",
    "공공계약관리": "contract",
    "공공조달 관리실무": "practice",
}

# '100분의 10' 의 '분'을 분(minute)으로 잘못 읽지 않도록 '분의'를 앞에 두고, '분' 뒤에 '의'가 오면 제외한다
UNIT = (r"(천분의\s?\d+|백분의\s?\d+|\d*분의\s?\d+|퍼센트|%|％|억원|만원|천원|원|개월|년간|년|일|회|명|시간|배|점|분(?!의))")
NUM = re.compile(r"(?<![\d.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*" + UNIT)
# 단위가 가리키는 것과 핵심 아이디어가 묻는 것이 맞아야 한다
UNIT_KIND = [
    (re.compile(r"(퍼센트|%|％|분의)"), "비율"),
    (re.compile(r"(억원|만원|천원|원)$"), "금액"),
    (re.compile(r"(개월|년간|년|일|시간)$"), "기간"),
    (re.compile(r"회$"), "횟수"),
    (re.compile(r"명$"), "인원"),
    (re.compile(r"점$"), "점수"),
    (re.compile(r"배$"), "배수"),
]
QKIND = [
    (re.compile(r"(비율|률|요율|백분율|목표)"), "비율"),
    (re.compile(r"(금액|기준금액|한도|보증금|수수료|규모|상한|하한)"), "금액"),
    (re.compile(r"(기간|일수|시효|연한|주기)"), "기간"),
    (re.compile(r"횟수"), "횟수"),
    (re.compile(r"(정족수|인원)"), "인원"),
    (re.compile(r"점수"), "점수"),
    (re.compile(r"배수"), "배수"),
]
# 시험에 나오지 않을 내용 — 교재 통계·학자 인용·교재 자기참조
SKIP = re.compile(r"(비중|구성비|추이|현황|통계|Harland|Siyal|Xim|Thai|OECD 평균|"
                  r"표준교재|교재의|\(20\d\d\)|억\s?달러|조\s?달러|세계은행|World Bank)")
INT_UNITS = re.compile(r"(개월|년간|년|일|회|명|시간|점|배)$")


def unit_kind(u):
    for rx, k in UNIT_KIND:
        if rx.search(u):
            return k
    return ""


def q_kind(idea):
    for rx, k in QKIND:
        if rx.search(idea):
            return k
    return ""


def untestable(a):
    """시험 문항으로 만들면 안 되는 내용인가."""
    blob = " ".join(clean(a.get(k)) for k in ("핵심 아이디어", "핵심 원리", "근거"))
    return bool(SKIP.search(blob))
QNOUN = re.compile(r"(비율|률|기간|금액|한도|일수|요율|점수|횟수|수수료|보증금|시효|상한|하한|규모|연한|주기|배수|정족수|기준금액|목표)")
LAWNAME = re.compile(
    r"(「[^」]{2,40}」|국가계약법|지방계약법|판로지원법|전자조달법|조달사업법|행정기본법|국가재정법|"
    r"건설산업기본법|소프트웨어\s?진흥법|클라우드컴퓨팅법|물품관리법|공공기관의 운영에 관한 법률|"
    r"중소기업제품 구매촉진 및 판로지원에 관한 법률)"
    r"\s*(시행령|시행규칙)?")
ADMRUL = re.compile(r"(\(계약예규\)\s*[^,;·]{4,30}|[^,;·]{2,20}(?:업무처리규정|집행기준|작성기준|체결기준|운용요령|심사기준|요령))")


# ---------------------------------------------------------------- 도움 함수

def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def empty(s):
    return clean(s) in ("", "없음", "-", "None")


def law_of(src):
    """근거 표기에서 발문에 쓸 규정 이름을 뽑는다. 없으면 빈 문자열."""
    src = clean(src)
    m = LAWNAME.search(src)
    if m:
        name = m.group(1).strip("「」")
        sub = m.group(2) or ""
        return (name + " " + sub).strip()
    m = ADMRUL.search(src)
    if m:
        return clean(m.group(1))
    return ""


def bigrams(s):
    s = re.sub(r"[^가-힣A-Za-z0-9]", "", s)
    return {s[i:i + 2] for i in range(len(s) - 1)} or {s}


def sim(a, b):
    A, B = bigrams(a), bigrams(b)
    return len(A & B) / max(1, len(A | B))


def fmt(v, unit):
    if unit == "년" and v >= 1900:
        return "%d년" % int(v)
    s = "{:,}".format(int(v)) if v == int(v) else ("%.1f" % v).rstrip("0").rstrip(".")
    return s + unit


FRAC = re.compile(r"^(\d*)분의\s?(\d+)$")


def frac_distractors(val, unit):
    """'100분의 10' 같은 표기는 분모를 건드리면 어색하다. 분자를 바꾼다."""
    m = FRAC.match(unit)
    if not m:
        return None
    den = int(m.group(1) or int(val))
    num = int(m.group(2))
    if den <= 0 or num <= 0 or num > den:
        return None
    cands = [num * 2, num * 3, num + 5, num + 10, max(1, num // 2), num + 1, max(1, num - 1)]
    out, seen = [], {num}
    for c in cands:
        if c <= 0 or c > den or c in seen:
            continue
        seen.add(c)
        out.append("%d분의 %d" % (den, c))
        if len(out) == 3:
            break
    return out if len(out) == 3 else None


def num_distractors(val, unit):
    """같은 단위에서 값만 바꾼 오답. 값이 다르면 반드시 틀리므로 검수가 필요 없다."""
    f = frac_distractors(val, unit)
    if f:
        return f
    if unit == "년" and val >= 1900:
        out = []
        for d in (1, 2, 3, 4):
            for c in (val - d, val + d):
                if c not in out and c != val:
                    out.append(c)
                if len(out) == 3:
                    return [fmt(c2, unit) for c2 in out]
        return [fmt(c2, unit) for c2 in out[:3]]
    ints = bool(INT_UNITS.search(unit))
    cands = [val * f for f in (2, 0.5, 3, 1.5)]
    if ints:
        cands = [c for c in cands if c == int(c)]
    step = 1 if val < 10 else (5 if val < 100 else (10 if val < 1000 else 1000))
    cands += [val + step, val - step, val + step * 2]
    pct = unit in ("퍼센트", "%", "％")
    out, seen = [], {round(val, 3)}
    for c in cands:
        if c <= 0:
            continue
        c = round(c, 2)
        if pct and c > 100:
            continue
        if c in seen or (val >= 10 and c != int(c)):
            continue
        seen.add(c)
        out.append(fmt(c, unit))
        if len(out) == 3:
            break
    return out


def mask_idea(body, idea):
    """〈보기〉가 정답 용어를 그대로 품고 있으면 문제가 성립하지 않는다. 가린다."""
    core = re.sub(r"\s*\([^)]*\)\s*", "", idea).strip()
    for t in sorted({idea, core}, key=len, reverse=True):
        if len(t) >= 4 and t in body:
            body = body.replace(t, "이것")
    return body


# ---------------------------------------------------------------- 문항 만들기

def q_term(a, peers, base):
    """B형 — 〈보기〉의 설명에 해당하는 것 고르기. 실제 시험에서 가장 많은 형태."""
    if untestable(a):
        return None
    idea, body = clean(a.get("핵심 아이디어")), clean(a.get("핵심 원리"))
    if not (40 <= len(body) <= 200) or len(idea) < 5 or len(idea) > 34:
        return None
    def topic(t):
        """앞머리 주제어. 이것이 같으면 둘 다 정답으로 읽힐 수 있다."""
        t = re.sub(r"\s*\([^)]*\)", "", t)
        m = re.match(r"([가-힣A-Za-z0-9·]{2,})", t)
        return m.group(1) if m else t[:4]
    ta = topic(idea)
    pool = [clean(p.get("핵심 아이디어")) for p in peers
            if p.get("atom ID") != a.get("atom ID")]
    pool = [p for p in pool if 5 <= len(p) <= 34 and sim(p, idea) < 0.34
            and topic(p) != ta and ta not in p and topic(p) not in idea]
    seen, uniq = set(), []
    for p in pool:
        if p in seen:
            continue
        seen.add(p)
        uniq.append(p)
    if len(uniq) < 3:
        return None
    ds = random.sample(uniq, 3)
    stem = mask_idea(body, idea)
    if "이것" not in stem and idea.split()[0] in stem:
        return None
    ch = ds + [idea]
    random.shuffle(ch)
    it = dict(base)
    it.update({"kind": "term", "q": "다음 〈보기〉에서 설명하는 것은?",
               "stem": stem, "choices": ch, "answer": ch.index(idea), "full": body})
    return it


def q_value(a, base):
    """C형 — 법령이 정한 값 고르기. 발문이 규정을 먼저 밝히고 선지는 값만 둔다."""
    vp = value_pair(a)
    if not vp:
        return None
    if not q_kind(clean(a.get("핵심 아이디어"))):
        return None      # 무엇을 묻는지 제목에 드러나지 않으면 발문이 성립하지 않는다
    idea, body = vp["label"], vp["body"]
    m = NUM.search(body)
    ds = num_distractors(vp["val"], vp["unit"])
    if len(ds) != 3:
        return None
    ans = vp["ans"]
    head = (vp["law"] + "상 ") if vp["law"] else ""
    ch = ds + [ans]
    random.shuffle(ch)
    it = dict(base)
    josa = "는?" if (ord(idea[-1]) - 0xAC00) % 28 == 0 else "은?"
    it.update({"kind": "value", "q": "%s%s%s" % (head, idea, josa),
               "stem": "", "choices": ch, "answer": ch.index(ans), "full": body})
    return it


def value_pair(a):
    """'{무엇}: {값}' 한 쌍을 만든다. 수치형 검사를 통과한 atom만."""
    idea, body = clean(a.get("핵심 아이디어")), clean(a.get("핵심 원리"))
    if untestable(a):
        return None
    ms = NUM.findall(body)
    if len(ms) != 1:
        return None
    m = NUM.search(body)
    around = body[max(0, m.start() - 1):m.start()] + body[m.end():m.end() + 1]
    if any(c in around for c in "~\u223c\u2015-"):
        return None
    qk, uk = q_kind(idea), unit_kind(m.group(2))
    if not uk:
        return None
    if qk and qk != uk:
        return None          # 묻는 것과 단위가 어긋나면 버린다
    if not qk and not law_of(a.get("근거")):
        return None          # 수량어가 없으면 법정 수치인 것만 쓴다
    try:
        val = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    if val <= 0:
        return None
    label = re.sub(r"\s*(의 원칙|원칙|제도|개요|이해|정의|의의|확대|변경|조정|산정|적용|운영|관리|방법|범위)$", "", idea).strip()
    if not (4 <= len(label) <= 30):
        return None
    if re.search(r"(제도|개요|이해|정의|의의|구분|비교|차이)$", label):
        return None
    return {"a": a, "label": label, "val": val, "unit": m.group(2),
            "ans": fmt(val, m.group(2)), "law": law_of(a.get("근거")), "body": body}


def q_pair(pairs, base_of):
    """A형 부정형 — 짝지은 수치 중 옳지 않은 것 고르기. 실제 시험에 흔한 형태."""
    if len(pairs) < 4:
        return None
    four = random.sample(pairs, 4)
    bad = four[0]
    ds = num_distractors(bad["val"], bad["unit"])
    if not ds:
        return None
    wrong = "%s: %s" % (bad["label"], ds[0])
    ch = [wrong] + ["%s: %s" % (p["label"], p["ans"]) for p in four[1:]]
    if len(set(ch)) < 4:
        return None
    random.shuffle(ch)
    laws = {p["law"] for p in four if p["law"]}
    head = ("%s상 " % list(laws)[0]) if len(laws) == 1 else "공공조달 법령상 "
    it = dict(base_of(bad["a"]))
    it.update({"kind": "pair",
               "q": "%s정한 수치로 옳지 않은 것은?" % head,
               "stem": "", "choices": ch, "answer": ch.index(wrong),
               "full": "%s의 바른 값은 %s입니다. %s" % (bad["label"], bad["ans"], bad["body"]),
               "atom": bad["a"].get("atom ID")})
    return it


def q_blank(a, base):
    """E형 — 공식 예시문항 6번과 같은 형태.
    '건설산업기본법상 건설공사의 하도급 제한 규정이다. ( )에 들어갈 금액은?'"""
    vp = value_pair(a)
    if not vp or not vp["law"]:
        return None
    body = vp["body"]
    if not (30 <= len(body) <= 140):
        return None
    m = NUM.search(body)
    ds = num_distractors(vp["val"], vp["unit"])
    if len(ds) != 3:
        return None
    stem = body[:m.start()] + "(    )" + body[m.end():]
    kind = unit_kind(vp["unit"]) or "값"
    ask = {"금액": "금액", "비율": "비율", "기간": "기간", "횟수": "횟수",
           "인원": "인원", "점수": "점수", "배수": "배수"}.get(kind, "것")
    ch = ds + [vp["ans"]]
    random.shuffle(ch)
    it = dict(base)
    it.update({"kind": "blank",
               "q": "%s상 %s에 관한 규정이다. (    )에 들어갈 %s은?" % (vp["law"], vp["label"], ask),
               "stem": stem, "choices": ch, "answer": ch.index(vp["ans"]), "full": body})
    return it


MARK = "ㄱㄴㄷ"


def q_combo(peers, base_of):
    """D형 — ㄱㄴㄷ 중 옳은 것 모두 고르기. 틀린 보기는 값만 바꿔 만든다."""
    have = []
    for p in peers:
        if untestable(p):
            continue
        body = clean(p.get("핵심 원리"))
        if not (30 <= len(body) <= 130):
            continue
        have.append(p)
    if len(have) < 3:
        return None
    three = None
    for _ in range(12):
        c = random.sample(have, 3)
        b = [clean(x.get("핵심 원리")) for x in c]
        if max(sim(b[0], b[1]), sim(b[0], b[2]), sim(b[1], b[2])) < 0.45:
            three = c
            break
    if three is None:
        return None
    # 셋 중 하나를 숫자 바꿔 거짓으로 만든다. 숫자가 있는 것을 고른다.
        # (숫자가 없으면 이 묶음으로는 만들 수 없다)
    idxs = [i for i, p in enumerate(three) if NUM.search(clean(p.get("핵심 원리")))]
    if not idxs:
        return None
    bad = random.choice(idxs)
    lines, truth = [], []
    for i, p in enumerate(three):
        body = clean(p.get("핵심 원리"))
        if i == bad:
            m = NUM.search(body)
            try:
                v = float(m.group(1).replace(",", ""))
            except ValueError:
                return None
            ds = num_distractors(v, m.group(2))
            if not ds:
                return None
            body = body[:m.start()] + ds[0] + body[m.end():]
            truth.append(False)
        else:
            truth.append(True)
        lines.append("%s. %s" % (MARK[i], body))
    ok = "".join(MARK[i] for i in range(3) if truth[i])
    opts = ["ㄱㄴ", "ㄱㄷ", "ㄴㄷ", "ㄱㄴㄷ"]
    if ok not in opts:
        return None
    ch = ["%s, %s" % (o[0], o[1]) if len(o) == 2 else "ㄱ, ㄴ, ㄷ" for o in opts]
    ansname = "%s, %s" % (ok[0], ok[1]) if len(ok) == 2 else "ㄱ, ㄴ, ㄷ"
    it = dict(base_of(three[0]))
    it.update({"kind": "combo", "q": "다음 〈보기〉에서 옳은 것을 모두 고른 것은?",
               "stem": "\n".join(lines), "choices": ch, "answer": ch.index(ansname),
               "full": "틀린 보기는 %s입니다. 바른 내용은 이렇습니다. %s"
                       % (MARK[bad], clean(three[bad].get("핵심 원리"))),
               "atom": three[0].get("atom ID")})
    return it


# ---------------------------------------------------------------- 본체

def main():
    random.seed(20260914)
    atoms = json.load(open(os.path.join(BUILD, "atoms_v005.json"), encoding="utf-8"))
    crit = json.load(open(os.path.join(BUILD, "criteria273.json"), encoding="utf-8"))
    crit_subj = {c["id"]: c["subject"] for c in crit}
    link = {}
    p = os.path.join(BUILD, "allq_link.json")
    if os.path.exists(p):
        link = json.load(open(p, encoding="utf-8"))

    def subj_of(a):
        s = clean(a.get("과목"))
        if s in SUBJ_SLUG:
            return s
        gid = clean(a.get("연결 기준 ID")).split(",")[0].strip()
        return crit_subj.get(gid, "")

    def base_of(a):
        return {"atom": a.get("atom ID"), "t": clean(a.get("핵심 아이디어")),
                "subject": subj_of(a), "major": clean(a.get("주요항목")),
                "minor": clean(a.get("세부항목")), "imp": clean(a.get("중요도")),
                "src": clean(a.get("근거")), "cond": clean(a.get("적용조건·예외")),
                "conf": clean(a.get("혼동하기 쉬운 점")),
                "gid": clean(a.get("연결 기준 ID")).split(",")[0].strip()}

    def testable(a):
        """실제로 물어볼 만한 atom인가."""
        if link.get(a.get("atom ID"), {}).get("n", 0) >= 1:
            return True
        if clean(a.get("중요도")) == "높음":
            return True
        return clean(a.get("유형")) in ("수치", "구별", "예외")

    pool = [a for a in atoms if subj_of(a) in SUBJ_SLUG and testable(a)]
    print("문항 대상 atom %d개 / 전체 %d개" % (len(pool), len(atoms)))

    byminor = collections.defaultdict(list)
    for a in pool:
        byminor[(subj_of(a), clean(a.get("주요항목")), clean(a.get("세부항목")))].append(a)

    items, used = [], set()

    # 실제 시험의 유형 비중에 맞춰, 정답이 하나로 확정되는 것부터 만든다.
    # 1) 부정형(수치 짝) — 실제 24%
    bysubj = collections.defaultdict(list)
    for a in pool:
        vp = value_pair(a)
        if vp:
            bysubj[subj_of(a)].append(vp)
    for subj, ps in bysubj.items():
        free = list(ps)
        random.shuffle(free)
        while len(free) >= 4:
            take, free = free[:4], free[4:]
            it = q_pair(take, base_of)
            if it and it["atom"] not in used:
                items.append(it)
                used.add(it["atom"])

    # 2) 괄호형 — 공식 예시문항 6번의 형태
    for a in pool:
        if a.get("atom ID") in used:
            continue
        it = q_blank(a, base_of(a))
        if it:
            items.append(it)
            used.add(a.get("atom ID"))

    # 3) 수치형 — 발문이 바로 값을 묻는 형태
    for a in pool:
        if a.get("atom ID") in used:
            continue
        it = q_value(a, base_of(a))
        if it:
            items.append(it)
            used.add(a.get("atom ID"))

    # 4) 용어·설명 판별형 — 실제 44%
    for key, peers in byminor.items():
        for a in peers:
            if a.get("atom ID") in used:
                continue
            it = q_term(a, peers, base_of(a))
            if it:
                items.append(it)
                used.add(a.get("atom ID"))

    # 5) 조합형
    for key, peers in byminor.items():
        if len(peers) < 4:
            continue
        it = q_combo(peers, base_of)
        if it and it["atom"] not in used:
            items.append(it)
            used.add(it["atom"])

    by_sub = collections.defaultdict(list)
    for it in items:
        by_sub[it["subject"]].append(it)

    os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
    total = 0
    for subj, slug in SUBJ_SLUG.items():
        got = by_sub.get(subj, [])
        random.shuffle(got)
        for i, it in enumerate(got):
            it["id"] = "%s-%04d" % (slug.upper(), i + 1)
        with open(os.path.join(OUT, "data", "quiz.%s.json" % slug), "w", encoding="utf-8") as f:
            json.dump({"subject": subj, "slug": slug, "n": len(got), "items": got},
                      f, ensure_ascii=False)
        k = collections.Counter(x["kind"] for x in got)
        print("  %-22s %4d문항  설명 %3d · 부정 %3d · 괄호 %3d · 수치 %3d · 조합 %3d"
              % (subj, len(got), k["term"], k["pair"], k["blank"], k["value"], k["combo"]))
        total += len(got)
    print("객관식 %d문항" % total)


if __name__ == "__main__":
    main()
