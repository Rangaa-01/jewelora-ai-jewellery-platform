# AI model files

Model weights are **not** committed. Run `scripts/download_models.sh` (or `make models`)
to fetch them. The backend and the browser both use MediaPipe Tasks models:

| File | Purpose | Used by |
|------|---------|---------|
| `face_landmarker.task` | 478 face landmarks (ears, nose, forehead, jaw) | backend photo try-on, browser live try-on |
| `hand_landmarker.task` | 21 hand landmarks per hand (fingers, knuckles, wrist) | ring/bangle/bracelet fitting, ring size estimate |
| `pose_landmarker_lite.task` | 33 body landmarks (shoulders, hips, ankles) | necklace/haram/waist chain/anklet fitting |
| `selfie_multiclass_256x256.tflite` | hair / skin / clothes segmentation | occlusion masks |
| `mobilenet_v3_small.tflite` | image embeddings | visual search, stylist similarity |

The frontend loads the browser copies from `/models/*` (served from `frontend/public/models`,
populated by `scripts/download_models.sh` via a symlink or copy — see `docs/ai-tryon.md`).
