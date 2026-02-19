# AGENTS.md

## AD-AS Shock Studio Standards

- Use `π` and `πᵉ` in all user-facing labels and explanations. Do not show `pi` in UI text.
- Keep graph labels fully readable: no clipping, no overlap, and labels must remain inside plot bounds.
- Every clickable element must have a clear teaching purpose. Remove dead controls.
- Keep interactions consistent with the Cowen/Tabarrok growth-rate model:
  - Identity: `s = π + g`
  - AD: `π = s - g`
  - SRAS: `π = πᵉ + ΔSRAS + κ (g - g*)`
  - LRAS: `g = g*`
- Keep the student UI minimal and classroom-ready.
- Prefer short, plain-English explanations tied directly to sliders and curve shifts.
