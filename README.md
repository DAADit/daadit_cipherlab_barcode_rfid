# DAADit — RS38 RFID Inventory (Odoo 19.0)

Meerdere SGTIN-96 EPC's scannen met de CipherLab RS38 in **Barcode → Voorraadtelling**.
De module voegt een scanpaneel toe aan de standaard Barcode-app; Odoo verwerkt de
producten, tracking, aantallen en de uiteindelijke voorraadcorrectie zelf.

**Status: eerste versie voor staging.** Decoder, buffering en de frontend-adapter
zijn automatisch getest. De koppeling is gecontroleerd tegen de frontendcode van
een draaiende Odoo 19 Enterprise-installatie. Installatie in Odoo.sh en een fysieke
RS38-proef moeten nog worden uitgevoerd. Er is geen Enterprise-broncode opgenomen.

## Installeren op Odoo.sh

Deze repository is één module: het manifest staat in de root. Voeg de repository
als submodule toe aan de **stagingbranch** van de bestaande SH-projectrepository:

```sh
git submodule add -b 19.0 https://github.com/DAADit/daadit_barcode_rs38.git daadit_barcode_rs38
git add .gitmodules daadit_barcode_rs38
git commit -m "Add RS38 RFID inventory adapter"
git push
```

Gebruik bij een bestaande `addons/`-structuur die map als bestemming. Geef SH
leestoegang tot de private repository. Update na een geslaagde build de applijst,
verwijder eventueel het Apps-filter en installeer **DAADit — RS38 RFID Inventory**.
Afhankelijkheden: `stock_barcode` (Enterprise) en `barcodes_gs1_nomenclature`.
Herlaad de Barcode-pagina volledig na installatie/upgrades om nieuwe assets te laden.
Er zijn geen extra Python-pakketten, servers, IoT-boxen of API-sleutels nodig.

## Scanner en producten

1. RS38 met UHF-opzetstuk en actuele ondersteunde firmware.
2. Installeer [CipherLab Multi-Tag Output](https://www.cipherlab.com/en/download-c2429/Multi-Tag-Output.html).
   Configureer de vereiste Android toegankelijkheids- en notificatierechten.
3. Stel **End Character = `;`** in; stuur alleen de EPC-bank als 24 hextekens per tag.
   Geen TID, RSSI, PC/CRC-woorden, tijdstempels of decoratieve prefixes/suffixes.
4. Gebruik Chrome/PWA. Tik expliciet in het RFID-invoerveld voordat je de trigger indrukt.
   Als Android de invoer niet aflevert: controleer de firmware/APK en probeer eerst
   twee tags in een tekstveld. Het invoerveld gebruikt Android-tekstinvoer; het
   schermtoetsenbord kan verschijnen. De module stuurt de radio niet zelf aan.
5. Iedere fysieke eenheid heeft een unieke **SGTIN-96**-identiteit. Productbarcodes
   moeten overeenkomen met de gedecodeerde GTIN-14. Gebruik voorraadtracking en
   passende GS1-configuratie volgens Odoo. Serienummertracking is optioneel; bij
   serienummertracking moet de EPC-serie bij het Odoo-serienummer passen.

Referentie: [Odoo CipherLab-configuratie](https://www.odoo.com/documentation/saas-19.1/es/applications/inventory_and_mrp/barcode/setup/rfid.html).
Die instructie is voor 19.1; **deze module levert de hier beschreven adapter voor 19.0**.

## Gebruik

1. Open de standaard Barcode-app en een voorraadtelling. Selecteer/scan de locatie.
2. Klik **RS38 RFID scannen**, tik in het invoerveld en scan meerdere tags.
3. Controleer **Uniek**, **Dubbel** en **Niet verwerkt**. Ongeldige tags verschijnen
   bij Scanproblemen. Een afgebroken code blijft in het invoerveld tot een terminator
   of totdat je op Verwerk klikt; er is geen timer die een halve code accepteert.
4. Klik **Verwerk EPC's**. De module verwerkt de unieke identiteiten opeenvolgend
   via Odoo. Tijdens verwerking zijn de standaard knoppen tijdelijk geblokkeerd.
   Onbekende producten worden als niet verwerkt getoond en kunnen na correctie
   opnieuw met Verwerk worden aangeboden.
5. Controleer de **werkelijke Odoo-telregels**. Klik vervolgens op de normale
   Odoo-knop om de telling toe te passen. Verwerk EPC's valideert de telling niet.

RFID pauzeren zet de normale barcodebediening terug aan. Verwerk of wis eerst de
wachtende scans. **Wis wachtende scans** verwijdert alleen nog niet geaccepteerde
tags en de gedeeltelijke invoer; het draait verwerkte aantallen niet terug en wist
geen identiteitscache. Het aantal afgewezen invoeren blijft als diagnose zichtbaar.

## Grenzen van deze versie

- Alleen **voorraadtellingen (`stock.quant`)**; ontvangsten, leveringen en andere
  `stock.picking`-schermen houden hun bestaande gedrag.
- Alleen **SGTIN-96**. Andere formaten, vrije EPC's en leverancierscodes worden
  afgewezen; er is geen EPC-naar-product-koppeltabel of tag-encodingfunctie.
- De module gebruikt de bestaande Odoo-voorraadlogica. Bestaande getelde aantallen
  worden niet automatisch nul gemaakt. Start een schone telling en combineer niet
  zomaar reeds handmatig getelde exemplaren met RFID-scans van diezelfde exemplaren.
- De scanlijst is lokaal in de geopende Barcode-component: geen offline opslag,
  herstel na herladen, of ontdubbeling tussen verschillende apparaten. Niet herladen
  tijdens een telling. Een nieuwe geopende telling heeft een nieuwe scanlijst.
- Ontdubbeling blijft gelden bij pauzeren/hervatten in hetzelfde scherm. Locatie
  wijzigen met wachtende tags wordt bij verwerking geblokkeerd. Een tag hoort bij
  één locatie; tellen van dezelfde identiteit op twee locaties wordt niet ondersteund.
- Maximaal 5.000 unieke identiteiten per geopende telsessie; overloop wordt gemeld.
  Verwerk tussendoor kleinere batches. De radioreadsnelheid is niet de Odoo-
  verwerkingssnelheid: iedere EPC loopt door de bestaande verwerking.
- Batch-/lottracking volgt Odoo's bestaande gedrag. Gebruik de eerste proef met
  producten zonder tracking of met unieke serienummers; lotaantallen zijn geen
  vrijgavecriterium van deze eerste versie.
- Na een netwerkfout stopt de batch. Controleer de telregels; probeer de resterende
  EPC's expliciet opnieuw. Geaccepteerde URI's worden niet opnieuw aangeboden zolang
  dezelfde component geopend blijft.

## Techniek en tests

De eigen SGTIN-96-decoder gebruikt `BigInt` en levert een canonieke pure identiteit:
`urn:epc:id:sgtin:<bedrijfsprefix>.<artikelreferentie>.<serienummer>`.
De filterbits worden niet opgenomen, zodat dezelfde identiteit met gewijzigde
filterbits niet dubbel telt. De module roept het bestaande
`model.processBarcode(uri, {readingRFID: true})` aan en wacht ook de interne
`model.actionMutex` af. Daarna wordt Odoo's `uriInCache(uri)` gecontroleerd.
Onbekende of niet geaccepteerde tags worden niet als verwerkt gemarkeerd.

Het standaard Odoo-scanservicegedrag wordt niet wereldwijd vervangen. Invoerveld-
events worden lokaal afgevangen; standaard barcodes blijven buiten de ingeschakelde
RFID-modus ongewijzigd. Er zijn geen nieuwe server-endpoints, `sudo`-acties of ACL's.

```sh
npm test
python3 tests/check_module.py
```

De JavaScript-tests gebruiken voor de adapter gesimuleerde Odoo-services, inclusief
het asynchrone mutexgedrag. Ze zijn geen vervanging voor de stagingtest met echte
Odoo-modellen. Zie [acceptatieplan](docs/ACCEPTATIE.md) en
[brononderzoek](docs/TECHNIEK.md). CI voert de zelfstandige tests uit en roept de
gedeelde DAADit module-CI aan; de Community-installatietest kan Enterprise niet dekken.

Licentie: LGPL-3.0; zie `COPYING.LESSER` en `COPYING`.
