# CipherLab-handheld instellen voor RFID-scannen in Odoo

Korte handleiding voor de magazijnmedewerker of beheerder. Geldt voor CipherLab
RS36- en RS38-handhelds met UHF-lezer; de RS35 met UHF-module werkt hetzelfde.
Er is **geen extra software van DAADit** nodig op het apparaat: alleen de
gratis CipherLab-app Multi-Tag Output en de Odoo-app of Chrome.

## 1. Multi-Tag Output installeren en toestaan (eenmalig, 5 minuten)

1. Download **Multi-Tag Output** van de CipherLab-website
   (Support ‣ Downloads, zoek op "Multi-Tag Output") en installeer de APK.
2. Open de app één keer. Android opent dan het scherm **Toegankelijkheid**:
   tik op *Multi-Tag Output* ‣ zet **Use Multi-Tag Output** aan ‣ *Toestaan*.
   Op Android 13 of nieuwer eerst: Instellingen ‣ Apps ‣ Multi-Tag Output ‣
   menu (⋮) ‣ *Beperkte instellingen toestaan*. Sta ook meldingen toe.
3. In de app zelf (Setup): *Enabled* aan, *Exclude Duplicates* aan,
   UHF Tag Bank **EPC**, End Character **Enter** (`;` mag ook).
   Bevestig met het vinkje rechtsboven.

Controle: open de CipherLab-app *Notepad*, tik in het tekstveld en druk de
trigger in. De tagcode verschijnt als tekst. Zo niet: stap 2 nalopen.

## 2. Schermtoetsenbord uitzetten (eenmalig, 1 minuut)

CipherLab levert een leeg toetsenbord mee, zodat het scherm vrij blijft en
Gboard geen woorden in het scanveld kan zetten.

1. Instellingen ‣ Systeem ‣ Talen en invoer ‣ Schermtoetsenbord: controleer
   dat **NullKeyboard** aan staat.
2. Tik in een tekstveld, veeg de meldingenbalk omlaag en tik op
   **Toetsenbord wijzigen** ‣ kies **NullKeyboard**. (Of tik op het kleine
   toetsenbord-icoontje rechtsonder in de navigatiebalk.)

Terug naar Gboard kan altijd via dezelfde weg.

## 3. Odoo openen

- De **Odoo-app** (Play Store) met de bedrijfs-URL en je eigen login, óf
  **Chrome** met dezelfde URL. Beide werken.
- Ga naar **Barcode** ‣ open de ontvangst of levering.

## 4. Scannen

1. Onderaan het scherm staat de balk **RFID** met "Nog niets ontvangen".
2. **Ontvangst:** tik de productregel aan (of scan de productbarcode), houd
   de lezer bij de tag(s) en druk de trigger in. De balk toont
   "Ontvangen hh:mm:ss: …" en op de regel verschijnt het serienummer.
   **Levering:** alleen de trigger indrukken; Odoo herkent de tags.
3. Een tag van een ander artikel in de buurt wordt gemeld en genegeerd.
4. Klaar? **Bevestigen** zoals bij een gewone scan.

## Als er niets binnenkomt

| Controle | Oplossing |
| --- | --- |
| Staat de regelweergave open, niet het bewerkformulier van een regel? | Formulier sluiten (Negeren) |
| Toont *Toegankelijkheid* "Multi-Tag Output: Aan"? | Aanzetten (stap 1.2); na een app-reset staat dit uit |
| Werkt de tag in CipherLab Notepad? | Zo niet: lezer/app-probleem, niet Odoo |
| Is het apparaat net herstart of de RFID-service gecrasht? | Multi-Tag Output eenmaal uit- en weer aanzetten in Toegankelijkheid |

Instellingen in Odoo (per bedrijf): Voorraad ‣ Instellingen ‣ Barcode ‣
*RFID tags as serial numbers*: voorvoegsel(s) van de tags, lengte, één tag per
productscan, vreemde tags weigeren.
