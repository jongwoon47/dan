# DAN — Japan Storefront / Localization Draft (NOT SUBMITTED)

Last edited: 2026-10-09. All copy and availability are **drafts**, not claims that Japan release is ready.
Current submitted iOS build must stay unchanged during App Review.

## Japanese title / subtitle
- App name: DAN
- Subtitle (draft): 欲しい・借りたい・頼みたいをつなぐ
- Product message: 必要な人が先に依頼できるマーケットプレイス

## Promotional text (draft, review required)
買いたい、借りたい、おつかいを頼みたい。まずは依頼を投稿。条件が合う相手が見つかったらチャットで相談できます。

## Description (JP draft, feature gated)
DANは、「必要な人から」始まる依頼型のマーケットプレイスです。

**できること**
- 買いたいものを依頼する
- 借りたいものを探す
- 近くのおつかいやお手伝いを頼む
- 条件の合う相手と相談する
- お互いに納得してから受け渡し方法を決める

地域名で探せます。現在地の使用は任意で、許可しなくても依頼を検索できます。

**注意**
- この記載は、該当機能が実際に審査提出ビルドで動作することを確認した後に使用すること。
- 有料決済・エスクロー・補償など、未提供機能の宣伝は禁止。
- 対応地域と利用可能な機能を実際の提供範囲に合わせて明記。
- 日本向けのJPY料金・決済は未対応。現在の画面表示の取引金額はKRW。
- 取り扱い禁止品目、通報・ブロック、紛争対応、アカウント削除について日本語の説明と動作確認が必要。

## Screenshots storyboard
1. Home: 何をお探しですか？ with real demand (no fake data)
2. Explore: nearby district with real and privacy-safe results
3. Create: buy/borrow/errand/service 4 options
4. Detail: public neighborhood and fulfillment conditions, no exact location
5. Deal / Chat: real staged account demonstration with sensitive values redacted
6. Settings: Japanese display language, voluntary location, account controls

## App Review / rollout gate
- Confirm every screen, including signup, consent, creation, offers, messages, reporting, blocking, safety, support, deletion, error/empty/offline flows in Japanese; present build supports only a pilot subset.
- Language metadata localization in App Store Connect for ja-JP; Japanese screenshots from real-device target.
- Confirm app availability in Japan only after testing and operational readiness; do not set nationwide availability solely because ja-JP UI strings exist.
- Confirm Terms, Privacy, APPI notices, location data disclosure, data removal, support channel and required business/legal obligations with qualified reviewers.
- Ensure exact-location purpose string localized in bundled InfoPlist.strings and tested on a Japanese-language iPhone.
- Separate locale choice from fulfillment country; local on-site requests must not cross-border match.
- Introduce country_code, currency_code, structured Japanese addresses and timezone before genuine JP-priced transactions.
- Pilot users in one city; track real demand → response → connected → completed counts and repeat use.
