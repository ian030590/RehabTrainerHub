# RehabTrainerHub

<p align="center">
  <img src="apps/rehabtrainerhub/public/rehabtrainerhub.svg" alt="Rehab Trainer Hub logo" width="160" />
</p>

## 中文

RehabTrainerHub 是居家復健訓練入口，整合多個訓練工具：

- StrokeTrainer：中風復健訓練
- VisionTrainer：視覺訓練
- BrainTrainer：認知訓練

## English

RehabTrainerHub is a home rehabilitation training hub that brings multiple trainers together:

- StrokeTrainer: stroke rehabilitation training
- VisionTrainer: vision training
- BrainTrainer: cognitive training

## 資料夾結構 / Folder Structure

```text
.
|-- apps/
|   |-- rehabtrainerhub/   # 入口網站 / Hub site
|   |-- stroketrainer/     # StrokeTrainer
|   |-- visiontrainer/     # VisionTrainer
|   `-- braintrainer/      # BrainTrainer
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
2. 選擇要使用的 trainer：StrokeTrainer、VisionTrainer 或 BrainTrainer。
3. 依需求調整網頁設定，例如語言、字體大小、色彩模式與音效。
4. 選擇訓練分類與訓練模組。
5. 在訓練前設定畫面確認參數後開始。
6. 完成訓練後，可在成績結算畫面下載 CSV、重新開始或返回主畫面。

## How To Use

1. Open the RehabTrainerHub home screen.
2. Choose a trainer: StrokeTrainer, VisionTrainer, or BrainTrainer.
3. Adjust page settings as needed, such as language, font size, color mode, and sound.
4. Select a training category and module.
5. Confirm the pre-training settings, then start the session.
6. After training, use the results screen to download a CSV, restart, or return to the home screen.

## 注意事項 / Notice

本專案用於復健流程練習與軟體原型展示，不能取代醫療診斷、治療或復健建議。

This project is for rehabilitation workflow practice and software prototyping. It does not replace medical diagnosis, treatment, or rehabilitation advice.
