/**
 * Public pages the app points at. They must stay reachable: App Review opens
 * the privacy policy and the contact link while testing the app.
 */
const REPO_URL = 'https://github.com/ufukceyhanli/mind-to-mouth';

export const PRIVACY_POLICY_URL = `${REPO_URL}/blob/main/PRIVACY.md`;
export const SUPPORT_URL = `${REPO_URL}/issues`;

/** Where recordings go. Named once so the consent text and policy agree. */
export const SPEECH_SERVICE_NAME = 'NVIDIA’s AI model service';
