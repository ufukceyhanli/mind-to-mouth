# Mind to Mouth privacy policy

_Last updated: 11 November 2026 (accounts required, Google sign-in added)_

Mind to Mouth is a speaking-practice app made by Ufuk Ceyhanli, an individual developer. It gives you a random word, records you talking about it, and scores the talk. This page explains what the app does with your data. It is written to be read, not skimmed, and it is short because the app does very little with your data.

## What the app collects

**Your talk.** When you practise, the app records your voice through the microphone. It keeps the recording, the transcript, the scores and the coach's feedback on your phone so you can listen back and track progress.

**Your account.** You need an account to use the app. When you create one, the app stores your email address (or, with Sign in with Apple or Google, the address they give it, which with Apple may be a private relay address), the time you signed up and last signed in, and an account identifier. With Sign in with Apple it also keeps the name Apple shares the first time, if you allow that. The account is held by **Supabase** (Supabase Inc.), the sign-in service the app uses, in the region chosen when the project was created. Nothing else is stored with the account: talks, recordings, transcripts and scores stay on your phone and are never uploaded to it.

**Nothing else about you.** No analytics, no advertising, no tracking and no device identifiers. The app does not read your contacts, photos, location or anything else on the phone.

## What leaves your phone, and where it goes

To score a talk, the app sends the recording to **NVIDIA's AI model service** (`integrate.api.nvidia.com`), which turns the audio into text. The text of your talk is then sent to the same service once more so an AI coach can write feedback. If you turn on the optional pronunciation check in Settings, the recording is sent a second time for that purpose.

When you sign in, your email address and password (or Apple's or Google's identity token) go to **Supabase** (`supabase.co`) to create and check your session. Supabase processes that data as the app's service provider under its privacy policy at <https://supabase.com/privacy>. Sign in with Apple is handled by Apple under Apple's own terms, and Sign in with Google by Google under Google's.

Those are the only places your data goes. The developer does not run a server, never receives your recordings, and cannot see your talks. The developer can see the list of account emails in the Supabase dashboard and uses it for nothing except deleting accounts on request.

NVIDIA processes the audio and text under its own terms and privacy policy, which you can read at <https://www.nvidia.com/en-us/about-nvidia/privacy-policy/>. The app has no control over how long that service keeps request data.

## Your permission

The app asks for your explicit agreement, in plain words, before the first recording is sent. It will not record until you agree. You can withdraw that agreement at any time in **Profile → Privacy → Withdraw**; the app will then ask again before the next talk and will not send anything until you agree again.

You can also turn off microphone access for the app in iOS Settings. The app cannot record without it.

## Keeping and deleting your data

Recordings, transcripts and scores stay on your phone until you delete them. You can:

- delete a single talk by swiping left on it (or long-pressing it) in **Talks**, or with **Delete talk** on the talk's own screen;
- delete every talk, recording and score with **Profile → Privacy → Delete all talks and recordings**;
- delete the app, which removes everything it stored on the phone.

If you have an account, **Profile → Account → Delete account** removes it immediately, together with everything the sign-in service holds about it. Signing out keeps the account but removes the session from the phone. Deleting the app does not delete the account; sign in again and delete it, or ask through the contact link below.

Apart from an account you chose to create, the developer holds none of your data, so there is nothing else for the developer to delete on your behalf. For data already processed by NVIDIA's service, their privacy policy above describes their retention and how to contact them.

## Children

Mind to Mouth is not directed at children under 13 and does not knowingly collect data from them.

## Changes

If the way the app handles data changes, this page will be updated and the date at the top will change. Material changes will also be shown in the app before the next recording.

## Contact

Questions, problems with the AI coach's feedback, or anything else: open an issue at <https://github.com/ufukceyhanli/mind-to-mouth/issues>.
