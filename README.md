# 居家訓練網 Rehab Trainer Hub

<p align="center">
  <img src="apps/rehabtrainerhub/public/rehabtrainerhub.svg" alt="Rehab Trainer Hub logo" width="160" />
</p>

## 中文

居家訓練網是居家練習工具與衛教資訊的整合入口：

- MotorTrainer：上肢、下肢與動作協調練習
- VisionTrainer：視標、眼動、閱讀與視覺注意力練習
- BrainTrainer：注意、記憶與思考練習
- MouthTrainer：口說、理解與口腔動作練習

## English

Rehab Trainer Hub brings together home-practice tools and educational information:

- MotorTrainer: upper-limb, lower-limb, and movement-coordination practice
- VisionTrainer: visual-target, eye-movement, reading, and attention practice
- BrainTrainer: attention, memory, and thinking practice
- MouthTrainer: speech, comprehension, and oral-movement practice

## 資料夾結構 / Folder Structure

```text
.
|-- apps/
|   |-- rehabtrainerhub/   # 入口網站 / Hub site
|   |-- motortrainer/      # MotorTrainer
|   |-- visiontrainer/     # VisionTrainer
|   |-- braintrainer/      # BrainTrainer
|   `-- mouthtrainer/      # MouthTrainer
|-- packages/
|   |-- ui/                # 共用介面與瀏覽器工具 / Shared UI and browser utilities
|   |-- config-eslint/     # 共用 ESLint 設定 / Shared ESLint config
|   `-- config-tailwind/   # 共用 Tailwind 設定 / Shared Tailwind config
|-- docs/                  # 文件 / Documentation
|-- scripts/               # 腳本 / Scripts
|-- package-lock.json
|-- package.json
`-- turbo.json
```

## 使用方式

1. 進入 RehabTrainerHub 主畫面。
2. 選擇要使用的 trainer：MotorTrainer、VisionTrainer、BrainTrainer 或 MouthTrainer。
3. 依需求調整網頁設定，例如語言、字體大小、色彩模式與音效。
4. 選擇訓練分類與訓練模組。
5. 在訓練前設定畫面確認參數後開始。
6. 完成訓練後，可在成績結算畫面下載 CSV、重新開始或返回主畫面。

## How To Use

1. Open the RehabTrainerHub home screen.
2. Choose a trainer: MotorTrainer, VisionTrainer, BrainTrainer, or MouthTrainer.
3. Adjust page settings as needed, such as language, font size, color mode, and sound.
4. Select a training category and module.
5. Confirm the pre-training settings, then start the session.
6. After training, use the results screen to download a CSV, restart, or return to the home screen.

## 注意事項 / Notice

本專案提供一般資訊與自主練習工具，非醫療機構或職能治療所；不提供個別評估、診斷、醫囑或治療。所有結果只反映當次操作，不是醫療評估、診斷或療效指標。

This project provides general information and self-practice tools. It is not a medical facility or occupational therapy clinic and does not provide individualized assessment, diagnosis, medical orders, or treatment. Results reflect only the current activity.

## 部署文件 / Deployment

- [Auth and D1 setup](docs/auth-d1-setup.md)
- [管理後台與 Cloudflare 擴充設定](docs/admin-cloudflare-setup.md)

## 授權 / License

本 repository 的原始碼以 GNU Affero General Public License v3.0 授權，SPDX identifier 為 `AGPL-3.0-only`。完整條款請見 [LICENSE.md](LICENSE.md)。

The original source code in this repository is licensed under the GNU Affero General Public License v3.0, SPDX identifier `AGPL-3.0-only`. See [LICENSE.md](LICENSE.md) for the full license text.

GitHub 會依 repository 根目錄的 license 檔案偵測授權。若公開 repository 尚未顯示 AGPL-3.0，請先確認本次新增的 `LICENSE.md` 已推送到預設分支。

GitHub detects repository licenses from the license file in the repository root. If the public repository does not yet show AGPL-3.0, confirm that this `LICENSE.md` file has been pushed to the default branch.

## 第三方參考 / Third-Party References

下列項目是頁面中列名的參考專案或使用的第三方程式庫；它們各自保留原授權。本 repository 的 AGPL-3.0 授權不會重新授權第三方專案本身。

The following projects are referenced by the app pages or used as third-party libraries. They keep their own licenses. This repository's AGPL-3.0 license does not relicense those third-party projects.

| Project | Current license check | Notes |
| --- | --- | --- |
| brownhci/WebGazer | `GPL-3.0-or-later` in package metadata; GitHub license API did not classify the custom license file | Compatible with AGPL-3.0 for this web app use; preserve upstream notices. |
| michaelbach/FrACT10 | `GPL-3.0` | Compatible with AGPL-3.0. |
| styts/eye-training | No GitHub-detected license and no package license found | Reference only. Do not copy or adapt code/assets unless permission is clarified. |
| Jesper-N/foveaflow | `MIT` | Permissive; compatible with AGPL-3.0. |
| Fordi/eyegame | `CC-BY-SA-4.0` | Reference only. If code/assets are copied or adapted, preserve CC BY-SA obligations for that material. |
| visiontherapy/visiontherapy.github.io | `AGPL-3.0` | Compatible with AGPL-3.0. |
| muthuspark/javascript-games | `MIT` | Permissive; compatible with AGPL-3.0. |
| antfu/vue-minesweeper | `MIT` | Permissive; compatible with AGPL-3.0. |
| rbcavanaugh/mainConcept | `AGPL-3.0` | Compatible with AGPL-3.0. |

Last checked: 2026-07-20.
