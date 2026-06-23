# 💌 Partecipazione — Nicolas e Giulia

Invito digitale interattivo per il matrimonio di Nicolas Gentilucci e Giulia Cro.  
Tema Harry Potter, con busta animata, musica e gestione RSVP via WhatsApp.

**Live**: [nicogenti.github.io/Partecipazione](https://nicogenti.github.io/Partecipazione/)

## Stack

- React 19 + TypeScript
- Vite 6 + TailwindCSS 4
- Motion (animazioni)
- Lucide React (icone)

## Sviluppo Locale

**Prerequisiti**: Node.js 22+

```bash
npm install
npm run dev
```

L'app sarà disponibile su `http://localhost:3000`.

## Deploy

Il deploy su GitHub Pages avviene automaticamente ad ogni push sul branch `staging` tramite GitHub Actions.

```
staging → GitHub Actions (build + typecheck) → GitHub Pages
```

Per forzare un deploy manuale: Actions → "Deploy to GitHub Pages" → "Run workflow".

## Struttura

```
src/
  App.tsx       # componente principale
  main.tsx      # entry point
  index.css     # stili globali + font
assets/
  Hogwarts_logo.jpg
  harry_potter_theme.mp3
  albus-dumbledore-sign.jpg
  BigliettoInternoPartecipazione.jpeg
.github/
  workflows/
    deploy.yml  # CI/CD GitHub Actions
```

## Dashboard privata (#admin)

Sotto rotta nascosta `/Partecipazione/#admin` esiste una "Camera dei Segreti": un pannello privato che mostra gli RSVP ricevuti, con aggregati (ospiti totali, adulti, bambini, intolleranze), una mini-timeline degli ultimi 7 giorni, ricerca e sortable nella tabella dettagli, ed export CSV pronto per catering/villa.

La passphrase non è mai nel bundle del sito: viene solo inviata (header `X-Admin-Key`) alla Azure Function lato server, che la confronta con un app setting (`ADMIN_KEY`).

### Prerequisiti lato Azure

1. **Azure Storage Account** già esistente (lo stesso dove oggi vengono salvati gli RSVP).
2. Una **Azure Function App** (Node 20 LTS, piano Consumption = free tier).

### Variabili d'ambiente della Function

Imposta queste app settings dal portale (Configuration → Application settings):

| Setting | Descrizione |
|---|---|
| `STORAGE_ACCOUNT_URL` | es. `https://<account>.blob.core.windows.net` |
| `RSVP_CONTAINER_NAME` | il container dove salvate gli RSVP (es. `partecipazione`) |
| `ADMIN_KEY` | passphrase lunga (≥16 caratteri) che solo tu e Giulia conoscete |
| `RSVP_READ_SAS` | SAS **read + list** con scope limitato al solo prefisso `rsvp/` (vedi sotto) |
| `CORS_ORIGINS` | `https://nicogenti.github.io,http://localhost:3000` |

### Generare la SAS read-only scoper a `rsvp/`

- Portale → Storage account → Containers → clicca sul container → **Settings → Shared access tokens**.
- Permissions selezionate: **Read** + **List** (niente Write/Delete).
- Allowed blob prefix: `rsvp/`
- Expiry: scegli una scadenza ampia ma non infinita (es. la data del matrimonio + 60 giorni).
- Copia la stringa SENZA il `?` iniziale e incollala in `RSVP_READ_SAS`.

> 🔒 Miglioramento futuro: usare **Managed Identity** della Function + ruolo `Storage Blob Data Reader` sul container (zero segreti da ruotare).

### Deploy della Function (locale → Azure)

```bash
cd function
npm install
npm run build            # tsc → dist/

# Installa Azure Functions Core Tools (una tantum):
# https://learn.microsoft.com/azure/azure-functions/functions-run-local

func start               # test in locale: http://localhost:7071/api/rsvp-dashboard

# Deploy:
func azure functionapp publish <NOME_FUNCTION_APP> --publish-local-settings
```

### Variabili d'ambiente del frontend

Crea un file `.env` locale con:

```
VITE_DASHBOARD_ENDPOINT=https://<NOME_FUNCTION_APP>.azurewebsites.net/api/rsvp-dashboard
```

In produzione imposta `VITE_DASHBOARD_ENDPOINT` come secret/variable nelle GitHub Actions.

### Utilizzo

1. Apri https://nicogenti.github.io/Partecipazione/#admin
2. Inserisci la passphrase (`ADMIN_KEY`)
3. Vedi gli RSVP aggregati, ricerca, scarica CSV per il catering

### Note di sicurezza

- ❌ **Non committare** gli app setting reali né `.env` con la passphrase reale.
- ✅ La passphrase NON finisce mai nel bundle del sito ( gira solo client→server a runtime).
- ⚠️ La SAS pubblica attualmente usata dall'invito per l'upload foto (`VITE_AZURE_SAS` nel bundle) resta una questione di sicurezza separata da valutare in un follow-up.
