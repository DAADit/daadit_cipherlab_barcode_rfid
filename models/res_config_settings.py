# Copyright 2026 DAADit
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    cipherlab_rfid_prefix = fields.Char(related="company_id.cipherlab_rfid_prefix", readonly=False)
    cipherlab_rfid_length = fields.Integer(
        related="company_id.cipherlab_rfid_length", readonly=False
    )
    cipherlab_rfid_one_tag_per_scan = fields.Boolean(
        related="company_id.cipherlab_rfid_one_tag_per_scan", readonly=False
    )
    cipherlab_rfid_block_foreign = fields.Boolean(
        related="company_id.cipherlab_rfid_block_foreign", readonly=False
    )
    cipherlab_rfid_capture_text = fields.Boolean(
        related="company_id.cipherlab_rfid_capture_text", readonly=False
    )
