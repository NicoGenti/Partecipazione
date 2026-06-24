# 💌 Partecipazione — Nicolas e Giulia

Invito digitale interattivo per il matrimonio di Nicolas Gentilucci e Giulia Cro.  
Tema Harry Potter, con busta animata, musica e gestione RSVP via WhatsApp.

**Live**: [nicogenti.github.io/Partecipazione](https://nicogenti.github.io/Partecipazione/)

## Stack

- React 19 + TypeScript
- Vite 6 + TailwindCSS 4
- Motion (animazioni)
- Lucide React (icone)
- Azure Functions + Azure Blob Storage

## Sviluppo Locale

**Prerequisiti**: Node.js 22+

```bash
npm install
npm run dev
```

L'app sarà disponibile su `http://localhost:3000`.

Per testare le Azure Functions in locale:

```bash
cd function
npm install
npm run build
func start
```

## Deploy

Il deploy su GitHub Pages avviene automaticamente ad ogni push sul branch `staging` tramite GitHub Actions.

```
staging → GitHub Actions (build + typecheck) → GitHub Pages
```

Per forzare un deploy manuale: Actions → "Deploy to GitHub Pages" → "Run workflow".

Le Azure Functions si deployano separatamente con Azure Functions Core Tools:

```bash
cd function
func azure functionapp publish <NOME_FUNCTION_APP>
```

## Struttura

```
src/
  App.tsx              # componente principale
  azure.ts             # client per API/functions e URL pubblici blob
  PrivacyModal.tsx     # consenso privacy foto
  PhotoAlbum.tsx       # album foto
  RsvpModal.tsx        # conferma presenza
  main.tsx             # entry point
  index.css            # stili globali + font
function/
  RsvpDashboard/       # dashboard admin (read-only)
  RsvpSubmit/          # ricezione RSVP
  ConsentSubmit/       # ricezione consenso privacy + documento HTML
  PhotoUpload/         # upload foto con validazione
  PhotoList/           # elenco foto (anonimo)
  shared/              # storage client, CORS, tipi
assets/
  Hogwarts_logo.jpg
  harry_potter_theme.mp3
  albus-dumbledore-sign.jpg
  BigliettoInternoPartecipazione.jpeg
.github/
  workflows/
    deploy.yml         # CI/CD GitHub Actions
```

## Architettura di sicurezza

Il frontend non possiede più alcun token SAS:

- **Scritture** (RSVP, consenso, upload foto) passano tramite Azure Functions.
- **Letture** di foto e asset statici usano URL pubblici anonimi del container Blob.
- **Azure Functions** accedono allo Storage tramite Managed Identity (`Storage Blob Data Contributor`).
- La dashboard admin resta protetta da `X-Admin-Key` con confronto a tempo costante e rate limiting.

## Dashboard privata (#admin)

Sotto rotta nascosta `/Partecipazione/#admin` esiste la "Camera dei Segreti": un pannello privato che mostra gli RSVP ricevuti, con aggregati (ospiti totali, adulti, bambini, intolleranze), una mini-timeline degli ultimi 7 giorni, ricerca e sortable nella tabella dettagli, ed export CSV pronto per catering/villa.

La passphrase non è mai nel bundle del sito: viene solo inviata (header `X-Admin-Key`) alla Azure Function lato server, che la confronta con un app setting (`ADMIN_KEY`).

### Prerequisiti lato Azure

1. **Azure Storage Account** già esistente.
2. Una **Azure Function App** (Node 22 LTS, piano Consumption = free tier).
3. **Managed Identity** abilitata sulla Function App.
4. Ruolo `Storage Blob Data Contributor` assegnato alla Function App sullo Storage Account.
5. Container Blob con accesso pubblico **Blob** (solo lettura anonima dei blob, non elenco container).

### Variabili d'ambiente della Function

Imposta queste app settings dal portale (Configuration → Application settings):

| Setting | Descrizione |
|---|---|
| `STORAGE_ACCOUNT_URL` | es. `https://<account>.blob.core.windows.net` |
| `RSVP_CONTAINER_NAME` | il container dove vengono salvati i dati (es. `partecipazione`) |
| `ADMIN_KEY` | passphrase lunga (≥16 caratteri) che solo tu e Giulia conoscete |
| `CORS_ORIGINS` | `https://nicogenti.github.io,http://localhost:3000` |
| `CONSENT_TEMPLATE_BLOB_PATH` | percorso del template HTML per il documento di consenso, es. `templates/privacy-consent-v1.html` |
| `CONSENT_TEMPLATE_SHA256` | hash SHA-256 del template HTML per il controllo di integrità |

`RSVP_READ_SAS` e `STORAGE_ACCOUNT_KEY` possono essere mantenuti solo come fallback per sviluppo/transizione; in produzione la Function deve usare esclusivamente la Managed Identity.

### Deploy della Function (locale → Azure)

```bash
cd function
npm install
npm run build            # tsc → dist/

# Installa Azure Functions Core Tools (una tantum):
# https://learn.microsoft.com/azure/azure-functions/functions-run-local

func start               # test in locale: http://localhost:7071/api/rsvp-dashboard

# Deploy:
func azure functionapp publish <NOME_FUNCTION_APP>
```

### Variabili d'ambiente del frontend

Crea un file `.env.local` con:

```
VITE_API_BASE_URL=https://<NOME_FUNCTION_APP>.azurewebsites.net
VITE_AZURE_ACCOUNT_URL=https://<ACCOUNT>.blob.core.windows.net
VITE_AZURE_CONTAINER=<NOME_CONTAINER>
VITE_DASHBOARD_ENDPOINT=https://<NOME_FUNCTION_APP>.azurewebsites.net/api/rsvp-dashboard
VITE_WATERMARK_ENABLED=true
```

In produzione imposta questi valori come secret/variable nelle GitHub Actions.

### Utilizzo

1. Apri https://nicogenti.github.io/Partecipazione/#admin
2. Inserisci la passphrase (`ADMIN_KEY`)
3. Vedi gli RSVP aggregati, ricerca, scarica CSV per il catering

### Note di sicurezza

- ❌ **Non committare** gli app setting reali né `.env*` con la passphrase reale.
- ✅ La passphrase NON finisce mai nel bundle del sito (gira solo client→server a runtime).
- ✅ Nessun token SAS finisce più nel bundle del sito.
- ✅ Le foto e gli asset statici sono serviti da URL pubblici anonimi, senza parametri di firma.
- ✅ Le scritture sono proxyate dalle Azure Functions con Managed Identity.
