# Copyright 2026 DAADit
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).

from odoo import api, models

from .rfid import clean_tracking_number


class StockMoveLine(models.Model):
    _inherit = "stock.move.line"

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("lot_name"):
                company = (
                    self.env["res.company"].browse(vals.get("company_id"))
                    if vals.get("company_id")
                    else self.env.company
                )
                vals["lot_name"] = clean_tracking_number(company, vals["lot_name"])
        return super().create(vals_list)

    def write(self, vals):
        if vals.get("lot_name"):
            company = self[:1].company_id or self.env.company
            vals = dict(vals, lot_name=clean_tracking_number(company, vals["lot_name"]))
        return super().write(vals)
