# Tablet Drum Machine

React + TypeScript + Vite + Tone.js で作る、タブレット横画面向けのドラムマシンです。

## できること

- 6 トラック x 16 ステップ
- セルの ON / OFF
- Play / Stop
- BPM / Filter / Reverb / Master volume
- `.drmpat` 形式の保存 / 読み込み
- Tone.js で固定サンプルを再生

## まず読むと分かりやすいファイル

1. `src/App.tsx`
2. `src/components/SequencerGrid.tsx`
3. `src/components/ControlStrip.tsx`
4. `src/services/audioEngine.ts`
5. `src/utils/patternFile.ts`

## 起動前に必要なもの

この環境では `node` と `npm` が見つからなかったため、まだ実行確認はしていません。

手元で動かすときは、まず Node.js を入れてください。

## 依存関係のインストール

```bash
npm install
```

## サンプル音声

`public/samples` に次のファイル名で音声を置いてください。

- `bass.wav`
- `snare.wav`
- `clap.wav`
- `chihat.wav`
- `ohat.wav`
- `cow.wav`

## 開発サーバー起動

```bash
npm run dev
```

## `.drmpat` の形式

JSON ベースで、次のプロパティを持ちます。

- `version`
- `bpm`
- `masterVolume`
- `filter`
- `reverb`
- `tracks`

## メモ

- レイアウトは 1024 x 768 を基準にしています。
- 幅が狭い画面でも崩れにくいように最低限のレスポンシブ調整を入れています。
