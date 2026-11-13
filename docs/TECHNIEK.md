# Onderbouwing en integratiegrens

Onderzocht op 13 november 2026:

- [Odoo 19.0 barcode service](https://github.com/odoo/odoo/blob/19.0/addons/barcodes/static/src/barcode_service.js).
- [Odoo's toevoeging van hex-EPC-decodering](https://github.com/odoo/odoo/commit/a2aa9065e47c9dfa1d06674218a3a3c1c363dea3).
- [Bijbehorende Enterprise-wijziging #102854](https://mergebot.odoo.com/odoo/enterprise/pull/102854).
- [Odoo 19.0 RFID-inventarisatie](https://github.com/odoo/documentation/blob/19.0/content/applications/inventory_and_mrp/barcode/operations/scan_rfid.rst).

De bestaande 19.0 frontend van de aangesloten DAADit-omgeving is read-only bekeken.
De relevante interfaces zijn `@stock_barcode/components/main` (default export),
`stock_barcode.MainComponent` (template), `model.location`, `model.processBarcode`,
`model.actionMutex` en `model.uriInCache`. De standaard parser ondersteunt reeds
`urn:epc:id:sgtin` en berekent daaruit de GTIN en trackingcode. De modelcode onthoudt
verwerkte URI's in een Set.

Odoo 19 `processBarcode` plant de daadwerkelijke verwerking in een interne mutex
zonder die hele verwerking zelf af te wachten. Daarom wacht deze adapter expliciet
een volgende opdracht op dezelfde mutex af. De tests simuleren dat contract.

Aanvullend lokaal gecontroleerd:

- De nieuwe JS-bestanden zijn met de echte Odoo 19 JS-transpiler omgezet; imports
  verwijzen correct naar `@daadit_barcode_rs38/...`.
- Het scanpaneel is met OWL 2 in een DOM-testomgeving gemount. Invoer van twee EPC's,
  schermupdates, verwerken en opnieuw scannen zijn doorlopen met een modelstub.
- De daadwerkelijk uitgeleverde Odoo 19 URI-parser en `processBarcode`-ingang zijn
  apart uitgevoerd met een gesimuleerde recordcache/mutatielaag. GTIN/seriedecodering,
  native ontdubbeling en het overslaan van onbekende producten zijn bevestigd.

Deze aanvullende controles raken geen database en vervangen geen SH- of hardwaretest.

Er is geen Enterprise-code overgenomen. Deze module is een zelfstandige adapter,
geen volledige kopie/backport van de wijzigingen uit 19.1. De decoder ondersteunt
bewust alleen SGTIN-96. Een Odoo-upgrade moet de genoemde interfaces opnieuw toetsen.

De scanlijst en foutmeldingen bestaan alleen in het geopende scherm. De module
valideert geen voorraadcorrectie en schrijft niet rechtstreeks naar `stock.quant`.
De native URI-cache betekent 'Odoo heeft de URI verwerkt'; de gebruiker moet de
werkelijke telregels vóór toepassing controleren.
