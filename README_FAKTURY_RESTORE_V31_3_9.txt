L&M TECHNIC ENERGY — V31.3.9 FAKTURY RESTORE

CEL
Przywrócenie pełnej gałęzi FAKTURY PREMIUM V31 bez najmniejszej zmiany zamrożonego Pulpitu MASTER.

DO GITHUBA — katalog główny repozytorium
Wgraj i zastąp WYŁĄCZNIE te pliki:
1. app-main.js
2. invoice-v31.js
3. invoice-v31.css
4. invoice-master.png
5. version.json
6. service-worker.js

NIE USUWAJ I NIE PODMIENIAJ:
- index.html
- MASTER_PULPIT_MASTER.png
- manifest.webmanifest
- icon-192.png / icon-512.png / icon-maskable-512.png
- assets/
- plików RYNKI EU, USTAWIENIA, CRM i pozostałych MASTER-ów.

CO ZOSTAŁO PRZYWRÓCONE
- OFERTY -> aktywny przycisk „FAKTURY PREMIUM” -> pełny generator V31.
- KLIENCI -> PROFORMA / FAKTURA KOŃCOWA przekazują dane klienta bezpośrednio do generatora V31.
- KLIENCI -> FAKTURY otwierają historię faktur.
- invoice-master.png pozostaje 1:1 bez zmian.
- rachunek bankowy w generatorze: 46 1240 1037 1111 0011 2978 9216.
- PDF, podgląd LIVE, zapis historii i udostępnianie pozostają aktywne.

PULPIT MASTER
Nie został zmieniony ani o 1 piksel. Plik MASTER_PULPIT_MASTER.png nie jest zawarty w paczce aktualizacyjnej.

PO WGRANIU
1. Zatwierdź pliki w branch main.
2. Poczekaj na zielony status GitHub Pages.
3. Otwórz aplikację.
4. Wejdź: OFERTY -> FAKTURY PREMIUM.
5. Test dodatkowy: KLIENCI -> wybierz klienta -> PROFORMA lub FAKTURA KOŃCOWA.

Wersja: V31.3.9
Data: 27.08.2026
