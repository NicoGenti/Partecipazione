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
