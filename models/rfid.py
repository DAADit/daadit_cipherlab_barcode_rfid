# Copyright 2026 DAADit
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).

"""Shared helpers for RFID tags used as serial numbers.

What counts as a tag is set per company (Inventory settings): a prefix and,
optionally, the total length. Nothing tag-specific is fixed in code.
"""

import re

# Characters a reader may put around a tag: separators and whitespace.
_STRIP_CHARS = " \t\r\n;,"


def tag_regex_source(prefix, length):
    """Regular expression for tags: the prefix followed by hex characters."""
    prefix = (prefix or "").strip().upper()
    if not prefix:
        return False
    rest = (length or 0) - len(prefix)
    body = "[0-9A-F]{%d}" % rest if rest > 0 else "[0-9A-F]+"
    return "^" + re.escape(prefix) + body + "$"


def get_tag_regex(company):
    source = tag_regex_source(company.cipherlab_rfid_prefix, company.cipherlab_rfid_length)
    return re.compile(source) if source else None


def clean_tracking_number(company, value):
    """Strip reader separators; upper-case the value when it is an RFID tag.

    Ordinary lot names are only trimmed, so existing lot naming is untouched.
    """
    if not value or not isinstance(value, str):
        return value
    stripped = value.strip(_STRIP_CHARS)
    if not stripped:
        return value
    regex = get_tag_regex(company)
    upper = stripped.upper()
    if regex and regex.match(upper):
        return upper
    return stripped


def is_rfid_tag(company, value):
    regex = get_tag_regex(company)
    return bool(value) and bool(regex) and bool(regex.match(value))
