# Copyright 2026 DAADit
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).

{
    "name": "DAADit CipherLab Barcode RFID",
    "version": "19.0.1.0.3",
    "summary": "RFID tags as serial numbers in the Barcode app, read with CipherLab handhelds (RS35/RS36/RS38) and Multi-Tag Output.",
    "description": """
RFID tags as serial numbers in the Barcode app (CipherLab)
==========================================================
For CipherLab Android handhelds with a UHF RFID reader (RS35, RS36, RS38) and
the CipherLab *Multi-Tag Output* app, which types the tags it reads into the
focused field. Use the Barcode app in Chrome (or as a PWA) on the handheld.

Set per company in Inventory > Settings > Barcode: the tag prefix (the first
characters of your RFID labels), the total tag length and whether every tag
needs its own product scan. With an empty prefix nothing changes.

* A scanned code with that prefix is treated as a serial number, in receipts
  and in deliveries:
  - a tag that is already a serial number selects its own product line, no
    product scan needed (deliveries, returns);
  - a new tag becomes the serial number of the product scanned or selected just
    before (receipts).
* Several tags typed in one trigger press are cut apart on the configured
  prefix and length; reader separators (";" or ",", Enter, Space) are handled.
* On handhelds a small visible RFID field at the bottom of the Barcode screen
  keeps the focus and receives the typed tags as scans; it shows what was last
  received (setting "Read text from RFID apps", on by default).
* Receipts: several different tags in one scan are refused, the operator scans
  again (each new tag is linked to one item). Deliveries: several tags may be
  read at once; tags already scanned, unknown tags and tags of products that
  are not on the delivery are skipped, with one notification reporting counts.
* Codes shaped like an RFID tag (20 or more hexadecimal characters) without the
  prefix, e.g. tags of neighbouring goods, are refused instead of becoming a
  serial number (setting "Refuse other RFID tags", on by default).
* A tag that already belongs to another product, or is already used in the open
  operation, is refused with a clear message; enforced on the server as well.
""",
    "category": "Inventory/Inventory",
    "author": "DAADit",
    "website": "https://www.daadit.group",
    "license": "LGPL-3",
    "depends": ["stock_barcode"],
    "data": [
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "daadit_cipherlab_barcode_rfid/static/src/barcode_picking_model_patch.js",
            "daadit_cipherlab_barcode_rfid/static/src/rfid_text_capture.js",
        ],
    },
    "installable": True,
    "application": False,
}
