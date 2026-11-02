# StudioHub

Versione 0.4.0 — interfaccia **Blu notte**: sfondo blu, pannelli chiari, navigazione con icone e nomi, stile comune ai quattro moduli e all’area clienti. La Home include la sezione «Riprendi il tuo lavoro».

Piattaforma dimostrativa locale per uno studio professionale: quattro attività in un unico ambiente, con revisione dell’operatore ed esportazione dei risultati.

- **Documenti / DocFlow**: riconosce dati da PDF testuali, permette di correggere e approvare le proposte, crea un archivio di copie ordinate.
- **Controlli paghe / Payroll Control**: importa un CSV conforme al modello, applica regole dimostrative, registra stati e note, esporta le verifiche.
- **Report / ReportFlow**: uniforma export CSV dimostrativi, verifica la copertura dei trimestri, presenta grafici e genera PDF e ZIP per cliente.
- **Incassi e fatture / Riconcilia**: propone abbinamenti, gestisce acconti e più fatture, richiede la conferma dell’operatore ed esporta i residui.

## Avvio senza installare Python

**macOS, Mac con processore Apple Silicon (M1 e successivi)**

Estrai `StudioHub_MAC_AppleSilicon.zip`, poi apri `StudioHub Blu notte.app` con doppio clic. La versione è compilata per arm64, non per Mac Intel. Richiede macOS 12 o successivo; verificata sul Mac di sviluppo. L’app include il runtime Python. Non è notarizzata da Apple: eventuali avvisi di macOS devono essere valutati dall’utente, senza disattivare le protezioni del sistema.

**Windows 10/11 x64 Intel/AMD**

Estrai **tutto** `StudioHub_WINDOWS_x64.zip`, quindi apri `APRI STUDIOHUB.cmd`. Le cartelle `app` e `runtime` devono rimanere accanto al comando. Il runtime Python ufficiale è incluso; non serve installarlo. Non è un pacchetto Windows ARM nativo.

Il programma si apre nel browser predefinito. Per provarlo usa i pulsanti con dati fittizi. Prima di chiudere esporta il lavoro, quindi premi **Chiudi StudioHub**. Chiudere la sola scheda non arresta il server.

Il launcher verifica la versione della sessione: una sessione precedente non viene riutilizzata dalla versione Blu notte. L’app Mac si presenta come StudioHub Blu notte e usa un identificatore distinto.

## Salvataggio e area clienti

Il caricamento di un lotto attiva automaticamente il salvataggio locale: non occorre premere un pulsante per la prima bozza. Il cliente iniziale è **Da assegnare**; usa **Cliente e dettagli** per assegnare cliente, periodo e titolo. Le modifiche vengono salvate poco dopo l’interazione e controllate ogni secondo. Attendi la conferma del salvataggio.

Apri **Riprendi il tuo lavoro** per ritrovare le attività **In corso**. Premi **Segna completata** per toglierle dalle attività da riprendere: restano nello storico, selezionando **Completate** o **Tutte**, e puoi riaprirle. Le lavorazioni completate sono consultabili; per modificarle premi **Riapri lavorazione**.

Si conservano PDF e approvazioni, note e stati paghe, export e impostazioni dei report, fatture, incassi e decisioni di abbinamento. Le esportazioni possono essere rigenerate dopo la ripresa. Il cliente classifica il lotto senza dividere automaticamente le aziende importate. Un nuovo lotto crea una nuova bozza.

L’archivio `lavorazioni.sqlite3` resta nella cartella dati, fuori dall’app e dal repository. È locale al computer e non sincronizzato tra Mac e Windows. In caso di spegnimento improvviso si recuperano i salvataggi confermati; le ultimissime modifiche ancora in trasmissione possono andare perse.

## Stato delle verifiche

- macOS: test del launcher e del runtime incluso riusciti, incluse API dei quattro moduli e download CSV, PDF e ZIP.
- Windows: pacchetto assemblato; **verifica su Windows ancora da eseguire** tramite il workflow `Verifica StudioHub su Windows`. L’esito non è stato anticipato nel README.
- I test automatici non sostituiscono una prova manuale su tutti i computer e browser.

## Verifica con GitHub Actions

Dopo aver caricato il contenuto di questo repository, incluso `.github/workflows/verifica-windows.yml`:

1. Apri **Actions** nel repository.
2. Scegli **Verifica StudioHub su Windows**.
3. Premi **Run workflow**, lascia `main`, premi il secondo **Run workflow**.
4. Apri l’esecuzione e attendi il risultato finale.
5. Se compare **Success**, scarica `StudioHub-Windows-x64-verificato` nella sezione **Artifacts**. Estrai l’archivio scaricato: contiene il pacchetto dell’app.
6. Se compare **Failure**, apri il passaggio rosso e consulta il log; non considerare verificato il pacchetto.

Il workflow ricompila i due moduli JavaScript, controlla calcoli e riconciliazioni, prepara il pacchetto Windows, prova il runtime incluso e usa Chromium per i quattro percorsi: PDF, verifica paghe con nota, report e grafici, riconciliazione. Verifica il download di CSV, PDF e ZIP. Conserva il pacchetto solo dopo il successo di tutti i controlli. Gli artifact scadono dopo 14 giorni: per una distribuzione durevole allegare il pacchetto verificato a una release.

## Sviluppo e confezionamento

Per eseguire i sorgenti serve Python 3.12 o successivo: `python server.py`. Su Mac è disponibile anche `APRI_STUDIOHUB.command`.

Per aggiornare i moduli HTML serve Node.js:

```sh
node reportflow/build.cjs
node riconcilia/build.cjs
node reportflow/verify.cjs
node --test reportflow/tests/charts.test.cjs
node --test riconcilia/tests/core.test.cjs
python tests/smoke_server.py
python -m unittest discover -s tests -p "test_*.py"
python tests/persistence_server.py
```

Il pacchetto Mac richiede PyInstaller 6.22.3, strumenti Apple per la firma locale e `sh scripts/build_macos.sh`. La firma locale non equivale alla notarizzazione Apple. Il builder non sovrascrive un’app esistente.

Il pacchetto Windows si prepara con `python scripts/build_windows.py`. Il builder verifica lo SHA-256 del runtime ufficiale prima di estrarlo. Il test esecutivo richiede Windows: `python tests/smoke_server.py --package "release/windows/StudioHub Windows"`. Per il browser: installare `requirements-test.txt`, poi `python -m playwright install chromium` ed eseguire `python tests/browser_windows.py --package "release/windows/StudioHub Windows"`.

## Dati e limiti

Prototipo con dati fittizi, privo di autenticazione e destinato all’uso locale. Nessuna compatibilità certificata con Zucchetti o TeamSystem, integrazione bancaria o SharePoint. Nessun invio email. OCR non incluso. Le regole paghe sono soglie dimostrative e richiedono valutazione professionale; l’app non certifica correttezza normativa, fiscale o contabile. Gli originali non sono modificati.

Il server ascolta soltanto su `127.0.0.1`, usando un URL di sessione casuale. I dati delle lavorazioni vengono conservati automaticamente in locale: l’archivio comprende anche le copie PDF necessarie alla ripresa. Le modifiche non ancora confermate possono andare perse. Gli allegati generati vengono trasferiti al solo server locale per il download e rimangono temporaneamente nella sua memoria; dopo la ripresa possono essere rigenerati.

I file di sessione e i log sono in `~/Library/Application Support/StudioHub Demo` su Mac e `%LOCALAPPDATA%\StudioHub Demo` su Windows. `STUDIOHUB_DATA` consente di usare una cartella separata nei test.

pypdf è distribuito con la licenza in `vendor/PYPDF_LICENSE.txt`; il pacchetto Windows include la licenza del runtime Python.

La Home presenta quattro riquadri interamente cliccabili e il nuovo logo senza punto finale. Navigazione: Home, Clienti, Documenti, Paghe, Report, Incassi.
