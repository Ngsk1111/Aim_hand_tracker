# Aim Hand Tracker MVP 0.1

俯瞰で撮影したエイム動画から、MediaPipe Hand Landmarkerで手の21点を検出して動画上に重ねる最小Webアプリです。

## 現在できること

- スマホ/PCから動画を選択
- 手を1つ検出
- 21ランドマークを描画
- 関節同士の骨格線を描画
- Left / Right の表示
- 推論時間の簡易表示
- 動画は端末内で解析（アプリ側のアップロード処理なし）

## 起動

静的Webサーバーで `index.html` を配信してください。

### PCで最短確認

Pythonがある場合:

```bash
python -m http.server 8000
```

その後 `http://localhost:8000` を開きます。

### iPhoneで使う

GitHub Pages / Cloudflare Pages / Netlify / Vercel などの静的ホスティングに、このフォルダをそのまま配置してください。
SafariでURLを開いて「動画を選択」を押せば使えます。

## 撮影条件（初期推奨）

- カメラはなるべく真上
- 手、マウス、マウスパッドを画面内に入れる
- 影を減らす
- 10〜20秒程度で試す
- まずは60fps以下を推奨（端末負荷確認のため）

## 次の段階

1. 21点座標をフレームごとに保存
2. 手首角度、指関節角度、移動速度を算出
3. マウス本体を別途検出/追跡
4. 手とマウスの相対運動から「手首主体 / 指主体 / 腕主体」を特徴量化
5. 評価UIを追加

## 技術

- HTML / CSS / JavaScript
- MediaPipe `@mediapipe/tasks-vision` 1.0.1
- Hand Landmarker float16 model

ネット接続は、初回のMediaPipeライブラリ・WASM・モデル読み込みに必要です。動画解析そのものはブラウザ上で実行します。
