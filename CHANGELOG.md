# Changelog

## 19.0.1.0.1

- Ververst de Odoo-telregels direct na het verwerken van een EPC-batch.
- Gevonden tijdens Avontuur-stagingacceptatie: 20 tags werden correct geteld,
  maar de zichtbare regel bleef zonder extra klik op een tussenstand staan.

## 19.0.1.0.0

- RS38-scanpaneel in de standaard Barcode-voorraadtelling.
- SGTIN-96 naar canonieke EPC-URI; meerdere EPC's per scannerinvoer.
- Ontdubbeling, begrensde scanbuffer, zichtbare ongeldige/afgewezen tags.
- Aansluiting op de bestaande Odoo 19 RFID-verwerking en URI-cache.
- Tests, GitHub CI, SH-installatiehandleiding en stagingacceptatieplan.
- Eerste versie: fysieke scanner- en SH-installatieacceptatie nog vereist.
