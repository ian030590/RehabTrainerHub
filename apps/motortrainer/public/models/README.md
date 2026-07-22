# Voice Defender speech assets

- `vosk-model-small-zh-tw-0.3.tar.gz` is derived from Vosk's
  `vosk-model-small-cn-0.3` archive. Its OpenFst input and output symbols were
  converted to Traditional Chinese offline with OpenCC-JS. Symbol IDs and
  acoustic model files are unchanged.
- `vosk-model-small-zh-tw-0.3-vocabulary.txt` is the exact non-special symbol
  list from that converted model.
- `vosk-model-small-en-us-0.15-vocabulary.txt` is the exact non-special symbol
  list from the default English model.

Model sources:

- https://alphacephei.com/vosk/models
- https://ccoreilly.github.io/vosk-browser/models/

OpenCC-JS was used only to produce the Chinese model asset and is not a runtime
dependency.

Run `npm run vosk:repair-zh-symbols` after rebuilding the converted Chinese
archive. It copies each Traditional Chinese input symbol to the corresponding
output symbol and verifies the vocabulary index.
