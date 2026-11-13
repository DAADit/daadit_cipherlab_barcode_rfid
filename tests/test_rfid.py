# Copyright 2026 DAADit
# License OPL-1 (https://www.odoo.com/documentation/master/legal/licenses.html).

from odoo.exceptions import ValidationError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestCipherlabBarcodeRfid(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        Product = cls.env["product.product"]
        cls.product_a = Product.create({"name": "RFID A", "is_storable": True, "tracking": "serial"})
        cls.product_b = Product.create({"name": "RFID B", "is_storable": True, "tracking": "serial"})
        cls.tag = "BE7100000000000000018ED9"
        # The tag format is a company setting, not a fixed value.
        cls.env.company.write({"cipherlab_rfid_prefix": "BE71", "cipherlab_rfid_length": 24})

    def test_reader_separator_is_stripped_and_uppercased(self):
        lot = self.env["stock.lot"].create({"name": "be7100000000000000018ed9;", "product_id": self.product_a.id})
        self.assertEqual(lot.name, self.tag)

    def test_ordinary_lot_names_keep_their_case(self):
        lot = self.env["stock.lot"].create({"name": " Batch-12a ;", "product_id": self.product_a.id})
        self.assertEqual(lot.name, "Batch-12a")

    def test_tag_cannot_belong_to_two_products(self):
        self.env["stock.lot"].create({"name": self.tag, "product_id": self.product_a.id})
        with self.assertRaises(ValidationError):
            self.env["stock.lot"].create({"name": self.tag, "product_id": self.product_b.id})

    def test_non_tag_names_may_repeat_across_products(self):
        self.env["stock.lot"].create({"name": "SN-1", "product_id": self.product_a.id})
        self.env["stock.lot"].create({"name": "SN-1", "product_id": self.product_b.id})

    def test_lookup_reports_conflict(self):
        self.env["stock.lot"].create({"name": self.tag, "product_id": self.product_a.id})
        Lot = self.env["stock.lot"]
        self.assertTrue(Lot.cipherlab_rfid_lookup(self.tag + ";", self.product_b.id)["conflict"])
        self.assertFalse(Lot.cipherlab_rfid_lookup(self.tag, self.product_a.id)["conflict"])
        known = Lot.cipherlab_rfid_lookup(self.tag)
        self.assertTrue(known["exists"])
        self.assertEqual(known["product_id"], self.product_a.id)
        self.assertFalse(Lot.cipherlab_rfid_lookup("BE7100000000000000099999")["exists"])

    def test_other_tag_types_are_not_treated_as_rfid(self):
        # Only codes with the configured prefix are RFID tags; other codes keep their case.
        lot = self.env["stock.lot"].create({"name": "e20020230427fcfc87507662", "product_id": self.product_a.id})
        self.assertEqual(lot.name, "e20020230427fcfc87507662")

    def test_move_line_lot_name_is_cleaned(self):
        picking_type = self.env.ref("stock.picking_type_in")
        picking = self.env["stock.picking"].create({
            "picking_type_id": picking_type.id,
            "location_id": self.env.ref("stock.stock_location_suppliers").id,
            "location_dest_id": picking_type.default_location_dest_id.id,
        })
        move = self.env["stock.move"].create({
            "product_id": self.product_a.id,
            "product_uom_qty": 1,
            "picking_id": picking.id,
            "location_id": picking.location_id.id,
            "location_dest_id": picking.location_dest_id.id,
        })
        picking.action_confirm()
        move.move_line_ids.write({"lot_name": self.tag.lower() + ";", "quantity": 1})
        self.assertEqual(move.move_line_ids.lot_name, self.tag)

    def test_config_follows_company_settings(self):
        config = self.env["stock.lot"].cipherlab_rfid_config()
        self.assertTrue(config["one_tag_per_product_scan"])
        self.assertEqual(config["tag_pattern"], "^BE71[0-9A-F]{20}$")
        self.assertTrue(config["block_foreign_tags"])
        self.assertEqual(config["prefix"], "BE71")
        self.env.company.cipherlab_rfid_length = 0
        self.assertEqual(self.env["stock.lot"].cipherlab_rfid_config()["tag_pattern"], "^BE71[0-9A-F]+$")

    def test_without_prefix_nothing_changes(self):
        self.env.company.cipherlab_rfid_prefix = False
        self.assertFalse(self.env["stock.lot"].cipherlab_rfid_config()["tag_pattern"])
        lot = self.env["stock.lot"].create({"name": "be7100000000000000018ed9", "product_id": self.product_a.id})
        self.assertEqual(lot.name, "be7100000000000000018ed9")
        # No cross-product check either.
        self.env["stock.lot"].create({"name": "be7100000000000000018ed9", "product_id": self.product_b.id})
