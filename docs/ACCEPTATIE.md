# Stagingacceptatie — nog uit te voeren

Gebruik een SH-stagingdatabase met de productieversie van Odoo 19.0 Enterprise,
de gewone rechten van een magazijnmedewerker en een RS38 met UHF-reader.

Leg firmware, APK-versie, Chrome-versie, Odoo-build en modulecommit vast.

| Test | Verwacht |
|---|---|
| Module installeren en Barcode → Voorraadtelling openen | Geen asset-/OWL-fouten; RFID-knop zichtbaar |
| Barcode → Ontvangst openen | Geen nieuw RFID-paneel; bestaande scanroute intact |
| 20 unieke SGTIN-96 tags van hetzelfde product, zonder tracking | 20 unieke tags; na Verwerk een schone Odoo-telling van 20 |
| Dezelfde 20 tags opnieuw scannen en verwerken | Telling blijft 20 |
| 10 tags van product A en 10 van B | Beide producten krijgen de juiste aantallen |
| Unieke serienummers | Juiste product-/serienummercombinaties, ieder maximaal één |
| Onbekende product-GTIN | Zichtbare fout, geen onterechte telling; herstel en opnieuw verwerken werkt |
| Afgebroken EPC en daarna resterende tekens | Geen voortijdige decode; één tag na afsluiting |
| SGTIN-198, vrije EPC, verkeerde lengte of RSSI-suffix | Zichtbaar afgewezen |
| Twee keer snel Verwerk aanklikken | Geen dubbele mutaties |
| RFID pauzeren en hervatten | Geaccepteerde identiteiten blijven ontdubbeld |
| Verlaat/toepassen met wachtende tags | Eerst verwerken of expliciet wissen |
| Locatie wijzigt na verzamelen | Verwerken op andere locatie geblokkeerd |
| Normale barcode, locatiebarcode, serienummerbarcode buiten RFID-modus | Bestaand Odoo-gedrag intact |
| Netwerk onderbreken tijdens Verwerk | Batch stopt; fout zichtbaar; herstel en controle vóór retry |
| Batch van 100 en vervolgens 500 tags | Alle tags verantwoord; geen verdwenen invoer of foutieve telling |
| Twee magazijngebruikers met verschillende toegangsrechten | Bestaande Odoo-rechten gelden |
| Browser volledig herladen | Nieuwe lokale scanlijst; geen belofte van herstel of cross-session deduplicatie |

Vergelijk altijd de Odoo-telregels met de fysiek bekende set, niet alleen de
paneelteller. Pas de voorraadcorrectie pas toe na die vergelijking. Test geen
productievoorraad als onderdeel van deze acceptatie.

Rollback: verwijder de module in staging en herlaad de browser. Reeds toegepaste
voorraadcorrecties worden daardoor niet teruggedraaid; herstel die via Odoo's
normale voorraadprocedure als dat nodig is.
