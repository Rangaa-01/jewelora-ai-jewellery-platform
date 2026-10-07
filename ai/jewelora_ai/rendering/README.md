# Renderers

`AffineCompositor` is the production renderer today: it warps the transparent asset with
the fitted affine transform, matches brightness to the local scene, applies soft occlusion
from segmentation masks (hair over earrings, necklaces and tikkas), adds a contact shadow
and alpha-composites.

## Adding a generative refinement renderer (integration boundary)

A diffusion/inpainting based renderer (for photoreal relighting, reflections and skin
contact) plugs in by implementing the `Renderer` protocol in `jewelora_ai/interfaces.py`:

```python
class Renderer(Protocol):
    def render(self, image_rgb, items: list[tuple[TryOnItem, Placement]], masks) -> np.ndarray: ...
```

Recommended pattern: run `AffineCompositor` first to obtain a geometrically correct draft
and the union of placement bounding boxes, then refine only inside those boxes with the
generative model conditioned on the draft (image-to-image, low strength) so identity, skin
tone, hair, clothing and background are preserved. Register the renderer with
`TryOnEngine(renderer=YourRenderer())` in `backend/app/services/tryon_service.py`.

Nothing in the platform assumes the renderer is deterministic; results are stored per
`tryon_results.engine_version`, so a new renderer must bump `ENGINE_VERSION`.
