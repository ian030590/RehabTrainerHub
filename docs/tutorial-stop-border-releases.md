# 教學「停止」複本邊框修正：21 款腦力練習發布候選

狀態：**發布候選，待擁有者核准**。

21 款腦力練習的教學場景用不能操作的 `span.btn` 複本呈現「停止」，基礎樣式只套用在 `button`，所以複本沒有邊框。`239cc879` 為 21 款補上 `span.btn` 規則，並在 `scripts/brain-r2-browser.mjs` 檢查教學複本與正式按鈕的邊框樣式、寬度、圓角與高度相同。每款只升 patch 版本，沒有其他行為改動。

## 發布候選

每款 5 個檔案。兩次重新建置的 digest 相同；發布工具會先重新建置，比對與下表一致才上傳並切換 current。

| gameId | version | contentSha256 |
| --- | --- | --- |
| `stop-signal` | `2.0.1` | `efb5c06f3cf11651b33a4417353751de607d2268de4d196d68c52b0948efddb0` |
| `sart` | `1.0.1` | `78f0a0d925f5654443ec20a99fc836ee37b50e63c39abc48116dfd0f32407d5d` |
| `hex-schulte` | `1.0.1` | `170ad41861699b51b86aecb2160193dc0b1994ce601a7c7bdbcf9e2df36de5f0` |
| `n-back` | `2.0.1` | `a7fbdb7a7bbb0d8232721023a54c3141660459ad66894eed47c20ef01205053d` |
| `stroop` | `2.0.1` | `ccd5153667e0af27fd9db0c5ab748e48b05881c8adfed6e3c0ab7a7496f6853d` |
| `schulte-grid` | `1.0.1` | `af42a184f98c650221fd616aef08b3f46a3b1f4d6af584ab869918b005853bcc` |
| `reaction-time` | `2.0.1` | `d76fedf1660188caa997d9c0eb58b512436b8f5fc6105fe5b7eec3d00c8c2bf9` |
| `digit-span` | `2.0.1` | `d17ebf1d77325824bfece5ddefc14fcadcf71d7fbba4eb9101f4c9a885d81921` |
| `go-nogo` | `2.0.1` | `b3a042cfdde9419e70270dede9f07d9d35cfd3d6353ccd593433a1fd7f74bab0` |
| `continuous-performance` | `1.0.1` | `1db5f8fb99b374b05eb6273953723bcc2f79d396dc0fbe992ca61c2487454455` |
| `flanker` | `2.0.1` | `adff5462b8d5fdc260eca63f62fae3ea7ba3ecc77317553ffea8a333c8b0b604` |
| `spatial-span` | `2.0.1` | `a5da104e65e7fbbce0a8bf9b9bf7fd6f8fa120930e8b33a236c2c6df22b33a3a` |
| `simon-task` | `1.0.1` | `2e07ebeeb218b695eb58a2f3b92e3def79b6a2b1650b260624109f6da945160a` |
| `number-letter` | `2.0.1` | `2749cf592fae49d33fde0458185ba035fc1f33892a3bfe856d941fba5dcfd5d9` |
| `card-sorting` | `1.0.1` | `fd482ea9c42208d56cc9134d947fdceeb52ad237f580e47b5750945e3babab82` |
| `tower-of-london` | `2.0.1` | `6abea6376a04e4ee614a008693087e3e5d76fe88ca228ce568d62be8b615f049` |
| `attentional-blink` | `1.0.1` | `94a03d3e36d8d8ea816a8f5e79f243e368f8144d4ae2ff57c064ed3f5def4f5a` |
| `time-perception` | `1.0.1` | `362631b27ae5981042c86a04484d8e4c89539d96e02b34fe3000d463eac735f8` |
| `attention-network-task` | `2.0.1` | `ce0654c559c97a05e1a820f02369e2a0ca9bb98815ca6b96d6eda49118752392` |
| `divided-attention` | `1.0.1` | `f75b6a83227cc3616a1529e44ee3f57648d29ac941525c4a6042427a6b3f1f18` |
| `pattern-memory` | `1.0.1` | `4a9466256ab9c2472b40708d5896c87337f8f0842b7af48a266624b760fe2cfa` |

與 UFOV 一起發布：`node .tmp/brain-tools/publish-approved.mjs .tmp/brain-tools/batch22-candidates.txt`（順序見 `docs/ufov-r2-migration.md`「發布候選」）。
