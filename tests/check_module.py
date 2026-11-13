"""Standalone structure checks, not an Odoo installation test."""

import ast
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
manifest = ast.literal_eval((ROOT / "__manifest__.py").read_text())
assert manifest["version"].startswith("19.0.")
assert "stock_barcode" in manifest["depends"]
for assets in manifest["assets"].values():
    for asset in assets:
        module, relative = asset.split("/", 1)
        assert module == "daadit_cipherlab_barcode_rfid"
        assert (ROOT / relative).is_file(), asset
for data in manifest.get("data", []):
    assert (ROOT / data).is_file(), data
for path in ROOT.rglob("*.xml"):
    ET.parse(path)
for path in ROOT.rglob("*.py"):
    ast.parse(path.read_text())
print("Manifest, assets, data, XML and Python syntax: OK (not an Odoo install test)")
