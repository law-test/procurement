#!/usr/bin/env python3
"""Validate the checked-in static site without private build inputs or packages."""
from collections import Counter
from html.parser import HTMLParser
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://jodal.pro/"
errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = Counter()
        self.links = []
        self.scripts = []
        self.script = None
        self.handlers = []
        self.atoms = set()
        self.feed(path.read_text(encoding="utf-8-sig"))
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids[attrs["id"]] += 1
        if tag == "a" and attrs.get("name"):
            self.ids[attrs["name"]] += 1
        if attrs.get("data-atom"):
            self.atoms.add(attrs["data-atom"])
        for key in ("href", "src", "poster", "action"):
            if attrs.get(key):
                self.links.append((attrs[key], self.getpos()[0]))
        for key, value in attrs.items():
            if key.startswith("on") and value:
                self.handlers.append((value, self.getpos()[0]))
        if tag == "script" and not attrs.get("src"):
            kind = attrs.get("type", "").lower()
            if kind in ("", "text/javascript", "application/javascript", "module"):
                self.script = {"line": self.getpos()[0], "code": "", "module": kind == "module"}

    handle_startendtag = handle_starttag

    def handle_data(self, data):
        if self.script is not None:
            self.script["code"] += data

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.scripts.append(self.script)
            self.script = None


def relative(path):
    return path.relative_to(ROOT).as_posix()


def target_path(source, href):
    resolved = urlsplit(urljoin(ORIGIN + relative(source), href))
    if resolved.scheme not in ("http", "https"):
        return None
    if resolved.hostname not in ("jodal.pro", "www.jodal.pro", "law-test.github.io"):
        return None
    path = unquote(resolved.path)
    if resolved.hostname == "law-test.github.io":
        if not path.startswith("/procurement/"):
            return None
        path = path[len("/procurement"):]
    dest = (ROOT / path.lstrip("/")).resolve()
    if not dest.is_relative_to(ROOT):
        return None
    if dest.is_dir():
        dest /= "index.html"
    return dest, unquote(resolved.fragment).split(":~:text=", 1)[0]


def validate_links(pages):
    checked = 0
    for source, page in pages.items():
        for identifier, count in page.ids.items():
            check(count == 1, f"{relative(source)}: duplicate id {identifier!r}")
        for href, line in page.links:
            dest = target_path(source, href)
            if dest is None:
                continue
            checked += 1
            path, anchor = dest
            label = f"{relative(source)}:{line}: {href}"
            check(path.is_file(), label + " -> missing local file")
            if path in pages and anchor:
                check(anchor in pages[path].ids, label + " -> missing anchor")
    return checked


def load_data(path):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (ValueError, UnicodeError) as error:
        errors.append(f"{relative(path)}: invalid JSON: {error}")
        return None


def validate_data(pages):
    cards, quizzes, counts = {}, set(), {}
    loaded = {p: load_data(p) for p in sorted((ROOT / "data").glob("*.json"))}
    for path in sorted((ROOT / "tools").glob("*.json")):
        load_data(path)
    for path, data in loaded.items():
        if not path.name.startswith("cards.") or data is None:
            continue
        label = relative(path)
        slug = path.stem.split(".", 1)[1]
        if not isinstance(data, dict) or not isinstance(data.get("cards"), list):
            errors.append(f"{label}: expected object with cards array")
            continue
        check(data.get("slug") == slug, f"{label}: slug differs from filename")
        check(type(data.get("n")) is int and data["n"] == len(data["cards"]), f"{label}: incorrect n count")
        check(isinstance(data.get("subject"), str) and bool(data["subject"]), f"{label}: missing subject")
        counts[slug] = len(data["cards"])
        for index, card in enumerate(data["cards"]):
            item = f"{label}:cards[{index}]"
            if not isinstance(card, dict):
                errors.append(item + ": expected object")
                continue
            for key in ("id", "t", "s", "c", "x", "r", "y", "i", "g", "m", "d"):
                check(isinstance(card.get(key), str), f"{item}: {key} must be a string")
            identifier = card.get("id")
            if not isinstance(identifier, str):
                continue
            check(bool(re.fullmatch(r"A\d+", identifier)), f"{item}: invalid atom ID")
            check(identifier not in cards, f"{item}: duplicate atom {identifier}")
            cards[identifier] = (slug, card)
            group = card.get("g", "")
            if not isinstance(group, str):
                continue
            page = pages.get(ROOT / "c" / group / "index.html")
            check(page is not None and identifier in page.atoms, f"{item}: missing concept page/anchor c/{group}/#{identifier}")
    for path, data in loaded.items():
        if not path.name.startswith("quiz.") or data is None:
            continue
        label = relative(path)
        slug = path.stem.split(".", 1)[1]
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            errors.append(f"{label}: expected object with items array")
            continue
        check(data.get("slug") == slug, f"{label}: slug differs from filename")
        check(type(data.get("n")) is int and data["n"] == len(data["items"]), f"{label}: incorrect n count")
        for index, quiz in enumerate(data["items"]):
            item = f"{label}:items[{index}]"
            if not isinstance(quiz, dict):
                errors.append(item + ": expected object")
                continue
            for key in ("id", "atom", "t", "subject", "major", "minor", "src", "cond", "conf", "gid", "kind", "q", "stem", "full"):
                check(isinstance(quiz.get(key), str), f"{item}: {key} must be a string")
            identifier = quiz.get("id")
            if isinstance(identifier, str):
                check(identifier not in quizzes, f"{item}: duplicate question ID {identifier}")
                quizzes.add(identifier)
            choices = quiz.get("choices")
            valid_choices = isinstance(choices, list) and len(choices) == 4 and all(isinstance(c, str) and c.strip() for c in choices)
            check(valid_choices, f"{item}: expected four nonempty choices")
            if valid_choices:
                check(len(set(choices)) == 4, f"{item}: duplicate choices")
            answer = quiz.get("answer")
            check(type(answer) is int and 0 <= answer < 4, f"{item}: answer must be a zero-based choice index")
            check(quiz.get("kind") in ("num", "art"), f"{item}: invalid question kind")
            check(quiz.get("subject") == data.get("subject"), f"{item}: subject differs from dataset")
            atom = quiz.get("atom")
            if not isinstance(atom, str) or atom not in cards:
                errors.append(f"{item}: unknown atom {atom}")
            else:
                card_slug, card = cards[atom]
                check(card_slug == slug, f"{item}: atom belongs to {card_slug}, not {slug}")
                group = quiz.get("gid", "").rsplit(".", 1)[0]
                check(group == card["g"], f"{item}: gid does not match concept group")
    html_atoms = set().union(*(page.atoms for page in pages.values()))
    check(html_atoms == set(cards), f"Concept HTML/data mismatch: {len(html_atoms - set(cards))} HTML-only, {len(set(cards) - html_atoms)} data-only")
    check(bool(cards) and bool(quizzes), "No card or quiz datasets found")
    return counts, len(quizzes)


def validate_javascript(pages, node):
    if not shutil.which(node):
        errors.append(f"Node.js not found: {node}. Install Node.js or pass --node /path/to/node.")
        return 0
    sources = []
    for path in sorted((ROOT / "assets").glob("*.js")):
        sources.append((relative(path), path.read_text(encoding="utf-8-sig"), False))
    for path, page in pages.items():
        for script in page.scripts:
            sources.append((f"{relative(path)}:{script['line']}", script["code"], script["module"]))
        for code, line in page.handlers:
            sources.append((f"{relative(path)}:{line} event handler", "function handler(event) {\n" + code + "\n}", False))
    # vm.Script compiles but never executes site code. Batch classic scripts in
    # one process; module scripts use Node's parser because imports are allowed.
    classic = [{"name": name, "code": code} for name, code, module in sources if not module]
    runner = "const fs=require('node:fs'),vm=require('node:vm');for(const s of JSON.parse(fs.readFileSync(0,'utf8'))){try{new vm.Script(s.code,{filename:s.name})}catch(e){console.log(s.name+': '+e.message);process.exitCode=1}}"
    result = subprocess.run([node, "-e", runner], input=json.dumps(classic), capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        errors.append("JavaScript syntax errors:\n" + result.stdout + result.stderr)
    for name, code, module in sources:
        if module:
            result = subprocess.run([node, "--check", "--input-type=module"], input=code, capture_output=True, text=True, encoding="utf-8")
            check(result.returncode == 0, f"{name}: {result.stderr}")
    return len(sources)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default="node", help="Node.js executable used for syntax checks")
    args = parser.parse_args()
    pages = {}
    for path in sorted(ROOT.rglob("*.html")):
        if not any(part.startswith(".") or part in ("node_modules", "work") for part in path.relative_to(ROOT).parts):
            pages[path] = Page(path)
    links = validate_links(pages)
    counts, quizzes = validate_data(pages)
    scripts = validate_javascript(pages, args.node)
    print(f"Checked {len(pages)} HTML pages, {links} local links, {scripts} JavaScript sources.")
    print(f"Cards: {sum(counts.values())} ({', '.join(f'{slug}={count}' for slug, count in sorted(counts.items()))}); questions: {quizzes}.")
    if errors:
        print(f"FAILED: {len(errors)} validation error(s)", file=sys.stderr)
        for error in errors:
            print("- " + error, file=sys.stderr)
        return 1
    print("PASS: static site references, study data, and JavaScript syntax are valid.")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
