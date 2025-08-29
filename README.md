# Chores Familias

App React (Vite + Tailwind) almacenando datos en LocalStorage (MVP). Para desplegar en producción (Netlify, Vercel, GitHub Pages o Firebase Hosting).

## Desarrollo local

Instala dependencias y levanta el server de desarrollo:

```bash
npm install
npm run dev
```

## Build producción

```bash
npm run build
npm run preview
```

Los archivos estáticos quedarán en `dist/`.

## Despliegue rápido

Recomendado: Vercel (auto build), Netlify o GitHub Pages.

1. Crea un repositorio Git (`git init`, commit).
2. Sube a GitHub.
3. Conecta en Vercel/Netlify y listo.

Para GitHub Pages (branch `gh-pages`):
- Instala `npm i -D gh-pages`.
- Agrega script: `"deploy": "vite build && gh-pages -d dist"`.
- Ejecuta: `npm run deploy`.

## TODO futuro
- Reemplazar LocalStorage por backend (Auth + DB + Storage).
- Subida de fotos real.
- Multi usuario con login.
