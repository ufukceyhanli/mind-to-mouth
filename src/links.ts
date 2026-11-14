/**
 * Public pages the app points at. They must stay reachable: App Review opens
 * the privacy policy and the contact link while testing the app.
 *
 * The site is the static Firebase Hosting site in `website/`; its privacy page
 * is generated from PRIVACY.md. If the Firebase project id changes, update
 * SITE_URL here and in `website/build.mjs`.
 */
/** Support mailbox. Empty until one exists; keep in step with website/build.mjs. */
export const SUPPORT_EMAIL = '';

export const SITE_URL = 'https://mind-to-mouth.web.app';
export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy`;
export const SUPPORT_URL = `${SITE_URL}/support`;
/** For the report link under AI-generated feedback: email if there is one, else the support page. */
export const REPORT_PROBLEM_URL = SUPPORT_EMAIL
  ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Mind to Mouth: coach feedback')}`
  : SUPPORT_URL;

/** Apple's standard licence agreement, which is the app's terms of use. Also goes in the App Store description. */
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
/** Where a subscription bought through Apple is managed and cancelled. */
export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * How the consent screen, Profile and the policy describe where the text of a
 * talk goes for coaching. Deliberately a category, not a vendor name: Apple
 * asks for disclosure of third-party AI processing, not for the provider to
 * be named, and naming it would give away the stack. Keep in step with
 * PRIVACY.md. Speech to text itself runs on the phone.
 */
export const COACH_SERVICE_NAME = 'a third-party AI service';
