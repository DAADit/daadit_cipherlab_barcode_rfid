# Copyright 2026 DAADit
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).

from odoo import api, models
from odoo.exceptions import ValidationError

from .rfid import clean_tracking_number, is_rfid_tag, tag_regex_source


class StockLot(models.Model):
    _inherit = "stock.lot"

    def _cipherlab_rfid_company(self, company_id=False):
        if company_id:
            return self.env["res.company"].browse(company_id)
        return self.company_id or self.env.company

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name"):
                company = self._cipherlab_rfid_company(vals.get("company_id"))
                vals["name"] = clean_tracking_number(company, vals["name"])
        return super().create(vals_list)

    def write(self, vals):
        if vals.get("name"):
            company = self._cipherlab_rfid_company(vals.get("company_id") or self[:1].company_id.id)
            vals = dict(vals, name=clean_tracking_number(company, vals["name"]))
        return super().write(vals)

    def _cipherlab_rfid_search(self, name, company_id):
        domain = [("name", "=", name)]
        if company_id:
            domain.append(("company_id", "in", [company_id, False]))
        return self.sudo().with_context(active_test=False).search(domain)

    @api.constrains("name", "product_id", "company_id")
    def _check_cipherlab_rfid_unique_across_products(self):
        for lot in self:
            company = lot.company_id or self.env.company
            if not is_rfid_tag(company, lot.name):
                continue
            other = (self._cipherlab_rfid_search(lot.name, company.id) - lot).filtered(
                lambda other_lot: other_lot.product_id != lot.product_id
            )[:1]
            if other:
                raise ValidationError(
                    self.env._(
                        "RFID tag %(tag)s is already linked to %(product)s. "
                        "Use a new tag for %(new_product)s.",
                        tag=lot.name,
                        product=other.product_id.display_name,
                        new_product=lot.product_id.display_name,
                    )
                )

    @api.model
    def cipherlab_rfid_config(self, company_id=False):
        """RFID settings of the operation's company, for the Barcode app."""
        company = self._cipherlab_rfid_company(company_id)
        return {
            "tag_pattern": tag_regex_source(
                company.cipherlab_rfid_prefix, company.cipherlab_rfid_length
            ),
            "one_tag_per_product_scan": company.cipherlab_rfid_one_tag_per_scan,
            "block_foreign_tags": company.cipherlab_rfid_block_foreign,
            "capture_text_input": company.cipherlab_rfid_capture_text,
            "prefix": (company.cipherlab_rfid_prefix or "").strip().upper(),
            "length": company.cipherlab_rfid_length or 0,
        }

    @api.model
    def cipherlab_rfid_lookup(self, tag, product_id=False, company_id=False):
        """Tell the Barcode app what is known about a tag.

        ``exists``: the tag is already a serial number, with its product.
        ``conflict``: it belongs to another product than ``product_id``.
        """
        company = self._cipherlab_rfid_company(company_id)
        tag = clean_tracking_number(company, tag)
        lot = self._cipherlab_rfid_search(tag, company.id)[:1]
        if not lot:
            return {"exists": False, "conflict": False}
        return {
            "exists": True,
            "product_id": lot.product_id.id,
            "product_name": lot.product_id.display_name,
            "conflict": bool(product_id) and lot.product_id.id != product_id,
        }
