# Mind to Mouth website

The public pages the app and the App Store listing link to, served by
[Firebase Hosting](https://firebase.google.com/docs/hosting) at
<https://mind-to-mouth.web.app>.

| Page | Source | Purpose |
| --- | --- | --- |
| `/` | `pages/index.html` | Landing page |
| `/privacy` | `../PRIVACY.md` (rendered by `build.mjs`) | Privacy policy URL for App Store Connect, linked from the app |
| `/support` | `pages/support.html` | Support URL for App Store Connect; FAQ, contact, account deletion (`#delete-account`) |
| `/404` | `build.mjs` | Not found |

`build.mjs` has no dependencies. It wraps each page in the shared layout
(`layout()` in the same file), converts `PRIVACY.md` to HTML and writes
everything to `public/`. The generated files are committed so the site can be
deployed from a clean checkout, and `firebase deploy` rebuilds them first
(`predeploy` in `firebase.json`).

```bash
npm run website:build     # regenerate public/ after editing PRIVACY.md or pages/
```

To preview, serve `public/` with any static server, for example
`python3 -m http.server 8080 --directory website/public`, and open
`/index.html`, `/privacy.html`, `/support.html` (Firebase's clean URLs only
apply once deployed).

## Deploying from GitHub (no local tooling)

`.github/workflows/website.yml` deploys the site with Firebase's official
GitHub Action. Every push to `main` that touches `website/`, `PRIVACY.md` or
the workflow redeploys, and the **Run workflow** button on the repository's
Actions tab deploys on demand. One-time setup, all in the browser:

1. Create a Firebase project at <https://console.firebase.google.com> (the
   free Spark plan covers this site). Use the project id `mind-to-mouth` so the
   default URL is `mind-to-mouth.web.app`; Google Analytics can stay off. If
   the id is taken, pick another and change it in four places: `.firebaserc`,
   `projectId` in the workflow, `SITE_URL` in `build.mjs` and `SITE_URL` in
   `../src/links.ts`, then update the URLs in `../APP_STORE.md` and
   `../README.md`.
2. In the project, open **Build → Hosting** and press **Get started**. Click
   through the wizard without running anything; it only needs to be opened once
   to turn Hosting on.
3. **Project settings** (gear next to *Project Overview*) → **Service
   accounts** → **Generate new private key**. A JSON file downloads. Treat it
   like a password: it can deploy to the project.
4. That key belongs to the *Firebase Admin SDK* service account, which cannot
   deploy Hosting on its own (it lacks `serviceusage.services.get`, so
   `firebase deploy` fails with `PERMISSION_DENIED`). Give it the roles the
   [action's docs](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)
   ask for: open <https://console.cloud.google.com/iam-admin/iam?project=mind-to-mouth>,
   find the principal that starts with `firebase-adminsdk-`, press the pencil,
   **Add another role** and add **Firebase Hosting Admin** and **API Keys
   Viewer**, then **Save**. (Alternatively create a dedicated service account
   with those two roles and use its key instead.)
5. On GitHub, open the repository's **Settings → Secrets and variables →
   Actions → New repository secret**. Name it `FIREBASE_SERVICE_ACCOUNT` and
   paste the whole contents of the JSON file as the value. Delete the
   downloaded file afterwards.
6. Merge this branch into `main` (or open Actions → *Website* → *Run workflow*
   once the workflow is on the default branch). The run takes about a minute
   and prints the live URL. Open `/privacy` and `/support` afterwards; App
   Review will.

To revoke the key later, delete it under Google Cloud → IAM → Service accounts
and replace the GitHub secret.

## Deploying from this machine (alternative)

Sign in once with `npx firebase-tools login` (behind the corporate proxy,
prefix Node commands with `NODE_OPTIONS=--use-system-ca`), then from the
repository root:

```bash
npm run website:deploy
```

That runs `build.mjs`, uploads `public/` and prints the live URL.

## Custom domain (optional)

Firebase Hosting → Add custom domain walks through the DNS records. Once it is
live, change `SITE_URL` in `build.mjs` and `../src/links.ts` so the canonical
links and the app point at the new domain, and update the URLs in App Store
Connect.
