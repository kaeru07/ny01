# AnglerLog Fishbrain 競合ASO実査（2026-07-20）

## 結論

AnglerLog の ASO スコアは **78/100を維持**する。Google Play 上の Fishbrain は 4.5、10M+ downloads、66.2K reviews で、`fishing app` / `fishing spots` / `log catches` を中心に強い実績があるため、一般的な「釣りアプリ」訴求で正面競合する余地は小さい。一方、端末内保存・登録不要・通信不要を前面に出す `private offline fishing log` は、Fishbrain の地図・予報・コミュニティ中心の訴求と分けて検証できる。

## 確認できた事実

- [Google Play](https://play.google.com/store/apps/details?id=com.fishbrain.app): 4.5、10M+ downloads、66.2K reviews、広告・アプリ内購入あり。主要訴求は釣り場マップ、予報、釣果ログ、コミュニティ、Fishbrain Pro。
- [Fishbrain公式サイト](https://fishbrain.com/): 20M catches、14M catch locations、20M anglers を掲げ、地図・釣り場情報を強く訴求。
- [公式Logbook紹介](https://fishbrain.com/features/logbook): 魚種、日時、サイズ、場所、道具、天候・月齢、写真、個人統計を提供。釣果ごとに公開範囲を選べるため、「個人記録」や「場所を隠せる」だけでは差別化にならない。

## スコア判断

- 需要: 高い。大手が10M+ downloadsを獲得しており、釣果ログを含むカテゴリ需要は検証済み。
- 競争: 高い。Fishbrainはログ、個人統計、位置情報の公開範囲まで既に提供している。
- 差別化余地: 中。AnglerLogはアカウント・外部送信・通信を不要にした軽量な個人台帳へ絞れる。
- ASO: 78/100を維持。需要の強さと競争の強さが相殺するため、実測前の加点・減点は行わない。

## 次の具体的で検証可能な1ステップ

ストア公開や課金実装の前に、ローカルMVPで「初回釣果を60秒以内に保存できるか」を5回計測する。開始は記録タブ表示、終了は一覧への保存反映とし、5回中4回以上が60秒以内なら `private offline fishing log` を主訴求候補として維持する。未達なら入力項目の初期表示を魚種・写真・サイズに絞る改善を次Epic候補にする。

