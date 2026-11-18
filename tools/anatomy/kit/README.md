# Anatomy kit (vendored)

`iso-kit.mjs`, `lathe.mjs`, `tube.mjs` and `audit.mjs` are copied unchanged from the
open-source Anatomy kit, github.com/wheresryan22/anatomy, commit
`1482e8469b0a9e0d8cc18ea2740a01423d29ae80`, under the MIT licence in `LICENSE`.

- `../scanhead.mjs` builds Fig 1 (the galvo scan head) with `iso-kit.mjs` and `lathe.mjs`.
- `../workstation.mjs` builds Fig 2 (the workstation) with all four; `tube.mjs` draws its
  cables and `audit.mjs` settles its drawing order and proves its geometry
  (`node tools/anatomy/workstation.mjs --audit`). Only the runtime parts of
  `iso-kit.mjs` and `lathe.mjs` are inlined into the page.
