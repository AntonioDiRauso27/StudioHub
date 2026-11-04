# StudioHub

Prototipo locale Python per organizzare documenti, verificare dati paghe, preparare report e confrontare fatture e incassi. Versione 0.8.6.

## Il percorso

Dalla Home carica documenti PDF o fatture elettroniche XML. I dati dimostrativi sono organizzati in Azienda Alfa, Azienda Beta e Azienda Gamma, ciascuna con sei dipendenti e dati coerenti tra paghe e report.

- **Documenti:** riconoscimento dell’azienda dalla denominazione, assegnazione automatica dei casi chiari e coda “Da identificare”. Il controllo dei dati è distinto dall’inclusione dei documenti nello ZIP. OCR non incluso.
- **Fatture XML:** riconoscimento dalla partita IVA emittente, estrazione di numero, data, cliente, totale e scadenze presenti; controllo duplicati e assegnazione manuale dei casi non riconosciuti. Sono gestiti XML FatturaPA ordinari TD01/TD06 in euro; non è una validazione fiscale o SdI.
- **Incassi:** importazione CSV bancari secondo il modello, proposte motivate, conferma dell’operatore ed esportazione delle decisioni. Nessuna scrittura contabile automatica. La tabella distingue ultimo caricamento e archivio completo.
- **Paghe:** regole dimostrative, stati, note e riepiloghi CSV; le segnalazioni non certificano errori nei cedolini.
- **Report:** importazione e mappatura CSV, copertura trimestrale, indicatori e grafici, PDF e riepiloghi ZIP. Nessuna compatibilità certificata con export specifici di Zucchetti o TeamSystem.

Il pulsante per gli XML misti genera quantità variabili di fatture nuove per ciascuna azienda. Ricaricare gli stessi file conserva invece il controllo dei duplicati.

## Avvio

**macOS Apple Silicon:** estrai StudioHub_MAC_AppleSilicon.zip e apri StudioHub App.app. Runtime incluso. Firma locale, app non notarizzata.

**Windows 10/11 x64:** il nuovo pacchetto deve essere generato e verificato dal workflow “Verifica StudioHub su Windows”. Dopo Success, scarica l’artifact, estrai lo ZIP e apri APRI STUDIOHUB.cmd mantenendo app e runtime accanto al comando. La precedente verifica Windows riguardava la versione 0.4.0.

**Sorgenti:** Python 3.12+, esegui `python server.py`. Per ricompilare i moduli: `node reportflow/build.cjs` e `node riconcilia/build.cjs`.

## Verifiche

`python -m unittest discover -s tests`

`node reportflow/verify.cjs`

`node --test riconcilia/tests/core.test.cjs`

Su GitHub: Actions → Verifica StudioHub su Windows → Run workflow → main. Attendere Success prima di distribuire il nuovo pacchetto Windows.

## Salvataggi e limiti

Salvataggio locale con ripresa, completamento e riapertura delle lavorazioni. Attendere la conferma del salvataggio prima di chiudere. Ultime modifiche non ancora confermate possono andare perse.

Dati su Mac: `~/Library/Application Support/StudioHub Demo`; Windows: `%LOCALAPPDATA%/StudioHub Demo`. `STUDIOHUB_DATA` consente una cartella separata per i test. I database, le sessioni e i log non fanno parte del repository.

Dimostrazione con dati fittizi, uso locale senza autenticazione. Nessun collegamento diretto a banca, gestionali o SharePoint. Importazioni esterne richiedono controllo dell’operatore. File P7M, note di credito e altri tipi XML non supportati richiedono gestione dedicata. La documentazione dei limiti e la verifica professionale restano necessarie prima di qualsiasi uso reale.

pypdf e runtime Python mantengono le rispettive licenze distribuite nei pacchetti.
