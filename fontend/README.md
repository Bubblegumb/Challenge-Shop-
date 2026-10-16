# NedsShop frontend

React + Vite frontend for the artwork auction learning project.
See the [project structure](../README.md),
[learning guide](../WEBSITE_LEARNING_GUIDE.md) and
[feature roadmap](../FEATURE_ROADMAP.md).

Run commands from this directory:

```powershell
npm ci
npm run dev
```

Checks: `npm run lint` and `npm run build`. Preview: `npm run preview`.

`src/main.jsx` mounts `src/App.jsx`. Global styles are in `src/styles/`.
Feature components are grouped under `src/components/`. The screen still shows
the Vite starter; this reorganisation does not implement login or bidding.
