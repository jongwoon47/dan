# App Review response draft (English)

Paste into App Store Connect Resolution Center after the new build is uploaded and demo credentials are verified.

---

Hello App Review team,

Thank you for the feedback on DAN 1.0. We have addressed each issue as follows.

**Guideline 4.8 – Login Services**  
DAN offers Google Sign-In for the primary account. We have added **Sign in with Apple** as an equivalent option on iOS. It uses Apple’s native Authentication Services sheet, limits data to name and email, supports Hide My Email, and does not use Sign in with Apple for advertising. The Apple button appears on the login screen with equal or greater prominence than Google.

**Guideline 2.1 – Demo account**  
We restored the production backend configuration and provisioned a dedicated App Review account with sample marketplace data. Please sign in with the credentials in **App Store Connect → App Review Information** (email/password). After sign-in, accept the terms and privacy checkboxes if prompted once, then you can browse demands, search, chats, and profile.

**Guideline 2.1(a) – Registration**  
New users can complete sign-up with email/password, Google, or Sign in with Apple, accept required consents, and reach the home screen. Please try a fresh install and create a new account with any of those methods.

If anything still fails, reply with the exact step and we will fix it immediately.

Thank you,  
DAN team

---

## App Store Connect checklist (before sending)

- [ ] New iOS build uploaded (version/build incremented)
- [ ] Sign in with Apple enabled on App ID + Supabase Apple provider
- [ ] Demo account email/password filled in Review Information (not in git)
- [ ] Production API reachable from the submitted binary
- [ ] Notes mention: after login, one-time terms/privacy consent may appear
