# DAN iOS preparation — staging only

This is an iOS source project, not a signed App Store binary. No Android project is generated. Apple account selected by the owner: `jongun0361@hanyang.ac.kr`; enrollment/team access has not been verified. Mac/Xcode access is not confirmed.

## What is prepared

- Capacitor iOS Xcode project using bundled web assets, not a remote website URL.
- Staging-only bundle ID `app.dan.staging` and display name `DAN Staging`. These are local preparation identifiers, not registered/approved App Store identifiers.
- `dan-staging://auth/callback` registered in Info.plist. Native OAuth uses the system browser and PKCE, exchanges a one-use code, and returns to the intended screen. Tokens are not accepted from arbitrary deep links.
- Kakao/Google availability follows Supabase Auth settings. Apple OAuth UI is included on native platforms as a preparation path and is disabled until its backend provider is configured.
- Browser dismissal/back restores the login buttons. Web email/OAuth flows remain supported.

## Rebuild on a Mac

1. Install Node 22+, Xcode 26+ and its command line tools; run `npm ci`.
2. Put only staging public Supabase URL/key in the local `.env.local`. No service-role/provider client secret belongs in it.
3. Run `npm run ios:staging`. This validates the staging target, builds and syncs native assets/plugins. Production packaging is deliberately disabled while its target remains unconfirmed.
4. Open `ios/App/App.xcodeproj`, select the owner's actual Apple Developer team and a device. Configure development signing in Xcode; do not commit credentials/profiles.
5. Add `dan-staging://auth/callback` to staging Supabase's Auth redirect allowlist, retaining its web redirect entries. Kakao/Google server callback remains the staging Supabase HTTPS `/auth/v1/callback` URL; the two callbacks serve different legs of the flow.
6. Validate cold/warm OAuth return, consent cancellation, app switching, keyboard/safe areas, chat, session reload and logout on actual iOS. JavaScript tests/Chromium cannot prove native runtime behavior.

## Gates before public App Store submission

- Confirm Apple Developer Program enrollment/team, final bundle ID, signing and a Mac/cloud build path. Do not purchase enrollment or create a paid service without owner authorization.
- Confirm a separate production backend/project/env through the existing release plan and a separately approved production task. Do not publish an app backed by this QA staging project.
- Complete live Kakao/Google and Apple login configuration/testing. App Review guideline 4.8 requires an equivalent privacy-preserving login option for general third-party-login apps; Apple login is the planned option, not a completed claim.
- Implement/verify in-app account deletion and provider-token revocation with safe handling of active trades/retained records. This is not yet implemented or claimed complete by the native source preparation.
- Supply truthful privacy/support/contact URLs, data collection answers, age/content rating, screenshots, review credentials and moderation/report/block coverage. Do not invent owner/legal information.
- Assess guideline 4.2 minimum functionality on the actual native experience; wrapping a website alone does not guarantee acceptance.
- Archive/sign on Mac, validate on device and TestFlight, then obtain the owner's separate approval for public submission.

References: [Capacitor iOS](https://capacitorjs.com/docs/ios), [native environment](https://capacitorjs.com/docs/getting-started/environment-setup), [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).
