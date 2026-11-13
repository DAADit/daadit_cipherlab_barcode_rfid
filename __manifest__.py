{
    "name": "DAADit — RS38 RFID Inventory",
    "summary": "Read multiple SGTIN-96 EPCs in the standard Barcode inventory count",
    "version": "19.0.1.0.1",
    "category": "Inventory/Inventory",
    "author": "DAADit",
    "website": "https://www.daadit.group",
    "license": "LGPL-3",
    "depends": ["stock_barcode", "barcodes_gs1_nomenclature"],
    "assets": {
        "web.assets_backend": [
            "daadit_barcode_rs38/static/src/epc.js",
            "daadit_barcode_rs38/static/src/session.js",
            "daadit_barcode_rs38/static/src/main.js",
            "daadit_barcode_rs38/static/src/main.xml",
        ],
    },
    "installable": True,
    "application": False,
}
