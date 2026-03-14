# Transformation Studio

Interactive web app for teaching and exploring geometric transformations on images.

Created by David Bachman with GPT-5 Codex

To learn more about David Bachman and his work visit https://pzacad.pitzer.edu/~dbachman/ and subscribe to his AI substack *Entropy Bonus* at https://profbachman.substack.com

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
