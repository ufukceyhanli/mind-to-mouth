# Mind to Mouth privacy policy

_Last updated: 8 November 2026_

Mind to Mouth is a speaking-practice app made by Ufuk Ceyhanli, an individual developer. It gives you a random word, records you talking about it, and scores the talk. This page explains what the app does with your data. It is written to be read, not skimmed, and it is short because the app does very little with your data.

## What the app collects

**Your talk.** When you practise, the app records your voice through the microphone. It keeps the recording, the transcript, the scores and the coach's feedback on your phone so you can listen back and track progress.

**Nothing about you.** There is no account, no sign-in, no name or email, no analytics, no advertising, no tracking and no device identifiers. The app does not read your contacts, photos, location or anything else on the phone.

## What leaves your phone, and where it goes

To score a talk, the app sends the recording to **NVIDIA's AI model service** (`integrate.api.nvidia.com`), which turns the audio into text. The text of your talk is then sent to the same service once more so an AI coach can write feedback. If you turn on the optional pronunciation check in Settings, the recording is sent a second time for that purpose.

That is the only place your data goes. The developer does not run a server, never receives your recordings, and cannot see your talks.

NVIDIA processes the audio and text under its own terms and privacy policy, which you can read at <https://www.nvidia.com/en-us/about-nvidia/privacy-policy/>. The app has no control over how long that service keeps request data.

## Your permission

The app asks for your explicit agreement, in plain words, before the first recording is sent. It will not record until you agree. You can withdraw that agreement at any time in **Settings → Privacy → Withdraw**; the app will then ask again before the next talk and will not send anything until you agree again.

You can also turn off microphone access for the app in iOS Settings. The app cannot record without it.

## Keeping and deleting your data

Recordings, transcripts and scores stay on your phone until you delete them. You can:

- delete a single talk by long-pressing it in **Talks**;
- delete every talk, recording and score with **Settings → Privacy → Delete all talks and recordings**;
- delete the app, which removes everything it stored.

Because the developer holds none of your data, there is nothing for the developer to delete on your behalf. For data already processed by NVIDIA's service, their privacy policy above describes their retention and how to contact them.

## Children

Mind to Mouth is not directed at children under 13 and does not knowingly collect data from them.

## Changes

If the way the app handles data changes, this page will be updated and the date at the top will change. Material changes will also be shown in the app before the next recording.

## Contact

Questions, problems with the AI coach's feedback, or anything else: open an issue at <https://github.com/ufukceyhanli/mind-to-mouth/issues>.
