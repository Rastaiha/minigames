#!/usr/bin/env python3
"""Precompute finite word-level continuation trees from Llama token logprobs."""

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import re
import subprocess
import threading
import time
from pathlib import Path

from wordfreq import zipf_frequency


MODEL = "cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast"
SYSTEM_PROMPT = (
    "متن فارسی ناتمام را مستقیماً ادامه بده. فقط ادامهٔ متن را بنویس؛ "
    "متن را تکرار نکن و توضیح نده."
)
SCENARIOS = {
    "triangle": "در مثلث قائم‌الزاویه با اضلاع ۳ و ۴",
    "dragon": "اژدهای نقره‌ای بال‌هایش را گشود",
}
COMMON_SHORT_WORDS = {"و", "در", "با", "از", "تا", "به", "که", "را", "بر", "یا"}
SUFFIXES = ("هایمان", "هایتان", "هایشان", "های", "ها", "ترین", "تر", "مان", "تان", "شان", "ام", "ات", "اش", "ان", "ین", "ش", "م", "ت", "ی")
ATTACHED_CONJUNCTION = re.compile(r"^و(?:در|از|با|بر|به|تا|که)$")
WORD_CHAR = re.compile(r"[0-9۰-۹\u0600-\u06ff]")
LEADING_SEPARATOR = re.compile(r"^[\s،؛,:.!؟]+")
WORD_SEPARATOR = re.compile(r"[\s،؛,:.!؟]+")
TERMINAL_PUNCTUATION = re.compile(r"[.!؟]\s*$")
NEXT_WORD_TOKEN = re.compile(r"^\s+\S")


class Gateway:
    def __init__(self, url, key, model, cache_path):
        self.url = url
        self.key = key
        self.model = model
        self.resolve = os.environ.get("LLM_CURL_RESOLVE", "")
        self.cache_path = cache_path
        self.lock = threading.Lock()
        try:
            self.cache = json.loads(cache_path.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            self.cache = {}

    def _save_cache(self):
        temporary = self.cache_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.cache, ensure_ascii=False))
        temporary.replace(self.cache_path)

    def query(self, seed, prefix, temperature, top_logprobs=5, max_tokens=1):
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": seed},
        ]
        body = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "top_k": 5,
            "max_tokens": max_tokens,
            "logprobs": True,
            "top_logprobs": top_logprobs,
            "stream": False,
        }
        if prefix:
            messages.append({"role": "assistant", "content": prefix})
            body["continue_final_message"] = True
            body["add_generation_prompt"] = False

        cache_key = hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        with self.lock:
            cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        config = "\n".join((
            "header = " + json.dumps("Content-Type: application/json"),
            "header = " + json.dumps("Authorization: Bearer " + self.key),
            # curl's config parser did not preserve raw Persian reliably. Keeping
            # the request ASCII-only via JSON escapes sends the exact same text.
            "data = " + json.dumps(json.dumps(body)),
        )) + "\n"
        command = [
            "curl", "-4", "--http1.0", "--silent", "--show-error",
            "--connect-timeout", "5", "--max-time", "15", "--config", "-",
        ]
        if self.resolve:
            command.extend(("--resolve", self.resolve))
        command.append(self.url)

        last_error = ""
        for attempt in range(7):
            result = subprocess.run(
                command,
                input=config,
                text=True,
                encoding="utf-8",
                errors="replace",
                capture_output=True,
            )
            try:
                payload = json.loads(result.stdout)
                if payload.get("error"):
                    raise RuntimeError(str(payload["error"]))
                content = payload["choices"][0]["logprobs"]["content"]
                if not content:
                    raise RuntimeError("No logprob positions returned")
                with self.lock:
                    self.cache[cache_key] = content
                    self._save_cache()
                return content
            except (KeyError, IndexError, json.JSONDecodeError, RuntimeError) as error:
                last_error = f"{error}; curl={result.returncode}; {result.stderr.strip()}"
                time.sleep(0.35 * (attempt + 1))
        raise RuntimeError(f"Gateway request failed after retries: {last_error}")


def visible_word(raw):
    text = LEADING_SEPARATOR.sub("", raw.strip())
    return WORD_SEPARATOR.split(text, maxsplit=1)[0]


def has_word(raw):
    return bool(WORD_CHAR.search(visible_word(raw)))


def valid_word(word):
    if (
        not word
        or re.search(r"[A-Za-z]", word)
        or word == "لا"
        or ATTACHED_CONJUNCTION.match(word)
        or re.search(r"(.)\1\1", word)
    ):
        return False
    if len(word) == 1 and word != "و" and not word.isdigit():
        return False
    if word in COMMON_SHORT_WORDS or word.isdigit() or all("۰" <= char <= "۹" for char in word):
        return True
    if zipf_frequency(word, "fa") >= 2:
        return True
    return any(word.endswith(suffix) and zipf_frequency(word[:-len(suffix)], "fa") >= 2 for suffix in SUFFIXES)


def greedy_word(gateway, seed, prefix, candidate):
    raw = candidate["token"]
    path_logprob = candidate["logprob"]
    for _ in range(4):
        if has_word(raw) and (raw[-1:].isspace() or TERMINAL_PUNCTUATION.search(raw)):
            break
        positions = gateway.query(seed, prefix + raw, 0, top_logprobs=5, max_tokens=6)
        progressed = False
        for position in positions:
            token = position["token"]
            if has_word(raw) and NEXT_WORD_TOKEN.match(token):
                return make_option(raw, path_logprob)
            raw += token
            path_logprob += position["logprob"]
            progressed = True
            if has_word(raw) and (raw[-1:].isspace() or TERMINAL_PUNCTUATION.search(raw)):
                return make_option(raw, path_logprob)
        if not progressed:
            break
    return make_option(raw, path_logprob)


def make_option(raw, path_logprob):
    word = visible_word(raw)
    return {
        "word": word,
        "append": raw,
        "probability": math.exp(path_logprob) * 100,
        "terminal": bool(TERMINAL_PUNCTUATION.search(raw)),
    }


def merge_options(options):
    merged = {}
    for option in options:
        if not valid_word(option["word"]):
            continue
        existing = merged.get(option["word"])
        if existing is None:
            option["strongestPath"] = option["probability"]
            merged[option["word"]] = option
        else:
            if option["probability"] > existing["strongestPath"]:
                existing["append"] = option["append"]
                existing["terminal"] = option["terminal"]
                existing["strongestPath"] = option["probability"]
            existing["probability"] += option["probability"]
    for option in merged.values():
        option.pop("strongestPath", None)
        option["probability"] = round(option["probability"], 4)
    return sorted(merged.values(), key=lambda option: option["probability"], reverse=True)[:5]


def build_tree(gateway, max_depth, workers):
    scenarios = {}
    for scenario_id, seed in SCENARIOS.items():
        root = {"options": []}
        scenarios[scenario_id] = {"seed": seed, "root": root}
        frontier = [(root, "")]
        for depth in range(max_depth):
            distributions = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {
                    executor.submit(gateway.query, seed, prefix, 1, 5, 1): (node, prefix)
                    for node, prefix in frontier
                }
                for future in concurrent.futures.as_completed(futures):
                    node, prefix = futures[future]
                    distributions[id(node)] = (node, prefix, future.result()[0]["top_logprobs"])

            jobs = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
                for node, prefix, candidates in distributions.values():
                    for candidate in candidates:
                        jobs.append((node, prefix, executor.submit(greedy_word, gateway, seed, prefix, candidate)))
                grouped = {}
                for node, prefix, future in jobs:
                    grouped.setdefault(id(node), (node, prefix, []))[2].append(future.result())

            next_frontier = []
            for node, prefix, options in grouped.values():
                node["options"] = merge_options(options)
                for option in node["options"]:
                    if depth + 1 < max_depth and not option.pop("terminal"):
                        child = {"options": []}
                        option["next"] = child
                        next_frontier.append((child, prefix + option["append"]))
                    else:
                        option.pop("terminal", None)
                        option["next"] = None
            frontier = next_frontier
            print(f"{scenario_id}: completed word depth {depth + 1}; next nodes: {len(frontier)}", flush=True)
        clean_appends(root)
    return scenarios


def clean_appends(node):
    """Keep model punctuation while presenting one clean, visible word per turn."""
    for option in node["options"]:
        option["append"] = re.sub(r"\s+", " ", option["append"]).strip()
        if option["next"]:
            clean_appends(option["next"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--depth", type=int, default=4)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("word-tree.js"))
    parser.add_argument("--cache", type=Path, default=Path("/tmp/next-word-tree-cache.json"))
    args = parser.parse_args()
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    api_url = os.environ.get("LLM_BASE_URL", "").strip()
    if not api_key or not api_url:
        raise SystemExit("Set LLM_API_KEY and LLM_BASE_URL before running this script.")
    gateway = Gateway(api_url, api_key, os.environ.get("TOKEN_MODEL", MODEL), args.cache)
    scenarios = build_tree(gateway, args.depth, args.workers)
    payload = {
        "model": gateway.model,
        "temperature": 1,
        "topK": 5,
        "greedySubwordTemperature": 0,
        "depth": args.depth,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scenarios": scenarios,
    }
    args.output.write_text(
        "window.NEXT_WORD_TREES = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    print(f"wrote {args.output}", flush=True)


if __name__ == "__main__":
    main()
