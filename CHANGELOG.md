# Changelog

## 19.0.1.0.1 — 2026-11-13

- RFID field asks the browser not to raise the on-screen keyboard
  (`virtualkeyboardpolicy="manual"`); the input connection stays, so the
  reader app still types into it.
- Verified that the Odoo Android app receives the tags as well.

## 19.0.1.0.0 — 2026-11-13

First release under the name `daadit_cipherlab_barcode_rfid` (previously the
customer-specific `avontuur_barcode_rfid`, developed for a DAADit customer).

- RFID tags as serial numbers in the Odoo 19 Barcode app, for receipts and
  deliveries; tag prefix and length are company settings.
- Visible RFID field on handhelds that receives the tags CipherLab
  Multi-Tag Output types into the focused field (no `inputmode="none"`:
  with it, Chromium gives the field no input connection and nothing arrives).
- Several tags typed in one trigger press are cut apart on prefix + length;
  reader separators (`;`, `,`, Enter, Space) are handled.
- Hexadecimal codes of 20 or more characters without the prefix (tags of
  neighbouring goods) are refused instead of becoming a serial number.
- A tag can belong to one product only; enforced in the app and on the server.
- Verified end to end on a CipherLab RS36 (Android 12, Multi-Tag Output
  0.1.3.1, Chrome 157) against Odoo 19.0 Enterprise on Odoo.sh.
