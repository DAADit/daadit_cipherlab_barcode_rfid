# DAADit CipherLab Barcode RFID (Odoo 19.0)

RFID tags as serial numbers in the standard **Odoo 19 Barcode app**, read with
**CipherLab** Android handhelds and the CipherLab **Multi-Tag Output** app.
Scan the product (or tap its line), pull the trigger: every tag read becomes the
serial number of that item. No extra clicks, no custom scanning screen, no
server-side services. Odoo's own receipt and delivery logic does the rest.

Built and maintained by [DAADit](https://www.daadit.group), Odoo partner, as part of
our CipherLab-to-Odoo integration work.

## Supported devices

| Device | UHF RFID | Status |
| --- | --- | --- |
| CipherLab **RS36** series | yes | verified end to end (Android 12, Multi-Tag Output 0.1.3.1, Chrome 157, Odoo 19.0 Enterprise on Odoo.sh), 13 November 2026 |
| CipherLab **RS38** series | yes | same reader service and Multi-Tag Output app; listed by Odoo as recommended RFID hardware |
| CipherLab **RS35** series with UHF reader | yes | same Multi-Tag Output app; not verified by us yet |

These are the CipherLab devices named in Odoo's RFID documentation
([Odoo 19 / saas-19.2, "RFID"](https://www.odoo.com/documentation/saas-19.2/applications/inventory_and_mrp/barcode/setup/rfid.html)).
Zebra readers use a different route (the Odoo Android app with Zebra RFID support)
and are outside the scope of this module.

Tags: any EPC written as hexadecimal text, identified by a configurable **prefix** and
**length** (for example `3034…` for GS1 SGTIN-96, or a customer-specific prefix).
No decoding of the EPC is needed: the tag string itself is the serial number.

## What it does

| Situation | Behaviour |
| --- | --- |
| Code starts with the configured prefix | Always treated as a serial number, never looked up as a product |
| Multi-Tag Output types the tag(s) into the focused field | A visible RFID field at the bottom of the Barcode screen keeps the focus, receives the text and processes it as a scan; it shows what was last received |
| Several tags in one trigger press, no separator | Cut apart on prefix + length; `;`, `,`, Enter and Space as separators work too |
| Known tag on a delivery or return | Odoo selects the product line itself, no product scan needed |
| New tag after a product scan or a tapped line | The tag becomes the serial number of that line |
| Tag without a product scan first | Refused: "Scan or select the item first" |
| Receipt: two different own tags in one scan | Refused, scan again at one item (each new tag is linked to one unit) |
| Delivery: several tags in one scan | Each tag processed on its own; tags already scanned, unknown tags and tags of products not on the delivery are skipped, one notification reports the counts |
| Hexadecimal code of 20+ characters without the prefix (a neighbouring item's tag) | Refused; read together with an own tag, only the own tag is used |
| Tag already used in this operation, or already linked to another product | Refused, in the app and on the server |

## Installation

Odoo 19.0 Enterprise with `stock_barcode`. Put this repository in your addons path
(on Odoo.sh: add it as a submodule to your project repository), update the apps list
and install **DAADit CipherLab Barcode RFID**. No extra Python packages, no IoT box,
no API keys. Reload the Barcode page fully after installing or upgrading.

## Settings

Per company, under **Inventory ‣ Settings ‣ Barcode ‣ RFID tags as serial numbers**:

- **RFID tag prefix**: the first characters of your tags (empty = module off).
- **RFID tag length**: total length including the prefix (0 = any length; glued tags
  can then not be cut apart, so configure a separator on the reader).
- **One tag per product scan**: after a linked tag, scan a product again first.
- **Refuse other RFID tags**: refuse 20+ character hex codes without the prefix.
- **Read text from RFID apps**: show the RFID field on handhelds.

## Device setup (CipherLab)

1. Install **Multi-Tag Output** from CipherLab. In Android, allow its notification
   permission and, on Android 13+, *Allow restricted settings* (Settings ‣ Apps ‣
   Multi-Tag Output ‣ ⋮). Turn on **Use Multi-Tag Output** under Settings ‣ Accessibility.
   After a reset of the app this switch is off again.
2. In Multi-Tag Output: *Enabled* on, *Exclude Duplicates* on, tag bank **EPC**,
   End Character **Enter** or `;` (Odoo's documentation uses `;`; both work).
3. Use the Barcode app in **Chrome**, as a PWA, or in the Odoo Android app: all three
   receive the tags (verified on the RS36).
4. Set the **CipherLab Null Keyboard** as the default keyboard (Settings ‣ System ‣
   Languages & input ‣ On-screen keyboard), otherwise the regular keyboard opens on the
   RFID field and its suggestions can end up in the field. The field deliberately has
   neither `inputmode="none"` nor `virtualkeyboardpolicy="manual"`: with either,
   Chromium gives the field no input connection and the reader app cannot type into it.
5. Do not drive or inspect the device with `uiautomator`-based tools while scanning:
   Android then interrupts all accessibility services and Multi-Tag Output exits.

Trigger pressed and nothing in the field? Make sure the line view is open (not the
edit form of a line), tap the RFID field once and pull the trigger again.

## Technical notes

- `stock.lot`: tag names are cleaned (separators removed, upper case); a tag may belong
  to one product only; `cipherlab_rfid_config` and `cipherlab_rfid_lookup` serve the client.
- `stock.move.line`: the same cleaning of `lot_name`.
- Client: a patch on the Barcode picking model (recognition, cutting, refusal, linking)
  and on the main screen (the RFID field). No new endpoints or access rights.
- Tests: `tests/test_rfid.py` (post_install) and `tests/check_module.py` (structure).

License: LGPL-3.0 or later, see [COPYING.LESSER](COPYING.LESSER) and [COPYING](COPYING).
See [CHANGELOG.md](CHANGELOG.md). Issues and questions: open an issue in this repository.
