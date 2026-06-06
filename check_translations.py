#!/usr/bin/env python3
"""Összegyűjti a témában használt fordítási kulcsokat és ellenőrzi, hogy
minden locale fájlban léteznek-e.

Futtatás: python check_translations.py
"""
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent
LOCALES_DIR = ROOT / "locales"

# Mappák, amikben fordítási kulcsokra hivatkozhatnak
SOURCE_DIRS = ["blocks", "sections", "snippets", "layout", "templates", "config"]

# {{ 'namespace.key' | t }} vagy {{ "namespace.key" | t: ... }}
STOREFRONT_KEY_RE = re.compile(r"""['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]\s*\|\s*t\b""")
# "t:namespace.key" séma fordítások (schema settings/blocks/presets)
SCHEMA_KEY_RE = re.compile(r'"t:([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)"')


def collect_keys():
    storefront_keys = set()
    schema_keys = set()

    for dirname in SOURCE_DIRS:
        directory = ROOT / dirname
        if not directory.is_dir():
            continue
        for path in directory.rglob("*"):
            if not path.is_file() or path.suffix not in (".liquid", ".json"):
                continue
            text = path.read_text(encoding="utf-8")
            storefront_keys.update(STOREFRONT_KEY_RE.findall(text))
            schema_keys.update(SCHEMA_KEY_RE.findall(text))

    return storefront_keys, schema_keys


def load_locale(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def has_key(data, dotted_key):
    node = data
    for part in dotted_key.split("."):
        if not isinstance(node, dict) or part not in node:
            return False
        node = node[part]
    return True


def find_missing(keys, locale_files):
    missing_by_file = {}
    for locale_path in locale_files:
        data = load_locale(locale_path)
        missing = sorted(key for key in keys if not has_key(data, key))
        if missing:
            missing_by_file[locale_path.name] = missing
    return missing_by_file


def main():
    storefront_keys, schema_keys = collect_keys()

    locale_files = sorted(LOCALES_DIR.glob("*.json"))
    storefront_locales = [p for p in locale_files if ".schema" not in p.name]
    schema_locales = [p for p in locale_files if ".schema" in p.name]

    missing = {}
    missing.update(find_missing(storefront_keys, storefront_locales))
    missing.update(find_missing(schema_keys, schema_locales))

    if not missing:
        print("Translations OK")
        return

    for filename, keys in missing.items():
        print(f"\n[{filename}] hiányzik {len(keys)} kulcs:")
        for key in keys:
            print(f"  - {key}")

    sys.exit(1)


if __name__ == "__main__":
    main()
