# Transformation Studio

Interactive web app for teaching and exploring geometric transformations on images.

## Live App

[Open Transformation Studio](https://davbachman.github.io/TransformationStudio/)

## What It Does

- Upload an image and transform it on a centered coordinate canvas.
- Build a transformation stack with:
  - Linear: Mirror, Scale, Shear, Rotate, Custom
  - Affine: Translate, Custom
  - Projective: Custom
  - Mobius: Custom
  - Anti-Mobius: Circle Inversion, Custom
- Edit transforms either graphically (manipulators) or by equation/matrix entries.
- Reorder or delete transforms in the right sidebar.
- Toggle transformed square/polar grids.
- Show/hide intermediate history overlays.

## How To Use

1. Click **Upload Image**.
2. Click a tool in the left sidebar to add a transform.
3. Use the red/yellow geometry handles on the canvas to adjust it.
4. Edit numeric values in **Matrix Definition** for precise control.
5. Reorder transforms by dragging them in the right sidebar.
6. Click any earlier transform in the stack to edit it.
7. Toggle **Square Grid**, **Polar Grid**, and **Previous Versions** as needed.

## Local Development

### Requirements

- Node.js 20+
- npm

### Run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

### Quality Checks

```bash
npm run lint
npm test
npm run build
```

## Deployment (GitHub Pages via Actions)

This repository is configured to deploy automatically from the `main` branch using GitHub Actions.

- Workflow file: `.github/workflows/deploy-pages.yml`
- Build output: `dist/`
- Pages base path is set automatically from the repository name during GitHub Actions builds.

After pushing to `main`, GitHub Actions publishes the app to:

- `https://davbachman.github.io/TransformationStudio/`
