# Copyright 2026 DAADit
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    cipherlab_rfid_prefix = fields.Char(
        string="RFID tag prefix",
        help="Scanned codes that start with this prefix, followed by hexadecimal "
        "characters, are RFID tags and are used as serial numbers in the Barcode app. "
        "Leave empty to switch the RFID handling off.",
    )
    cipherlab_rfid_length = fields.Integer(
        string="RFID tag length",
        help="Total number of characters of a tag, prefix included. 0 accepts any length.",
    )
    cipherlab_rfid_one_tag_per_scan = fields.Boolean(
        string="One tag per product scan",
        default=True,
        help="After a tag is linked, the next tag needs a new product scan or line "
        "selection. Switch off to scan several tags in a row for the same product.",
    )
    cipherlab_rfid_block_foreign = fields.Boolean(
        string="Refuse other RFID tags",
        default=True,
        help="Refuse scanned codes that look like an RFID tag (24 or 32 hexadecimal "
        "characters) but do not start with the prefix, e.g. tags of neighbouring "
        "goods or of a supplier. Without this, Odoo would use them as a new serial number.",
    )
    cipherlab_rfid_capture_text = fields.Boolean(
        string="Read text from RFID apps",
        default=True,
        help="Some RFID reader apps on handhelds write the tag as text into the active "
        "field instead of sending key presses. With this on, the Barcode app on a "
        "handheld keeps an invisible field ready that receives that text as a scan.",
    )
