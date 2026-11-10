# Pinned WebGazer eye models

These four Apache-2.0 model files are the exact version 1 bytes already pinned in [the eye asset manifest](../../../../scripts/eye-tracking-assets.manifest.json). The build reads these local sources and checks both size and SHA-256 before emitting either eye input version. No model, calibration algorithm, runtime URL or capability changed.

Official model cards: [MediaPipe FaceMesh](https://www.kaggle.com/models/mediapipe/facemesh/tfJs/default/1?tfhub-redirect=true), [TensorFlow BlazeFace](https://www.kaggle.com/models/tensorflow/blazeface/tfJs/default/1?tfhub-redirect=true). The historical TFHub source URLs remain in the manifest for provenance. License text is included in [the runner notices](../../THIRD_PARTY_NOTICES.txt), which are shipped with the runner.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| facemesh/model.json | 93029 | c922985d95e101e7fe56576a9a00366c72d3fab3604ce371cc9d85394abda99c |
| facemesh/group1-shard1of1.bin | 2955780 | f4a7075c1fff12ceafd2cd6fc000a464da90b1e0c35236971ed5bb3b343366cb |
| blazeface/model.json | 64036 | 7b6bb6f35e5a7899232de51dda8bf514ef9664ca7ec58388c9fecc088c883b58 |
| blazeface/group1-shard1of1.bin | 401768 | 60b481ab6c19352673cdb21e02e639f90883db1393ac52d07c7ea4e1e11cb2cd |

Fresh upstream downloads and the existing local cache were independently checked against these pinned digests on 2026-11-10. They total 3,514,613 bytes. Git attributes keep JSON and BIN files byte-for-byte on every platform. Do not regenerate, reformat or replace them without an explicit model update and new digest review.
