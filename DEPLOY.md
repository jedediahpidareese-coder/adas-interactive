# Deploying To Cloudflare Pages

This project is a static site (no build step), but local tooling files in `.tools/` are too large for Pages direct upload. Use the helper script to stage only web assets and deploy:

```powershell
.\deploy-pages.ps1
```

That script copies `index.html`, `cases.html`, `deploy.html`, `style.css`, `app.js`, `cases.js`, and `case-library.js` into a temporary `.pages-deploy` folder and runs `wrangler pages deploy`.

Model reminder: the simulator uses the Cowen-Tabarrok growth-rate identity `s = π + g`, where `s` is nominal spending growth. AD is `π = s - g`, SRAS is `π = πᵉ + ΔSRAS + κ(g - g*)`, and LRAS is `g = g*`.