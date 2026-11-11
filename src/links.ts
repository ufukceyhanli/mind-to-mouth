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

/** Where recordings go. Named once so the consent text and policy agree. */
export const SPEECH_SERVICE_NAME = 'NVIDIA’s AI model service';
