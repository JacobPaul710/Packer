# Setup

## A. Put the app online (GitHub Pages)

1. On github.com, create a new **public** repo named `packing-lists`. Do not add a README.
2. On your computer, run (replace YOUR-USERNAME):

```
unzip patch-1.zip
cd packlist
git init
git add .
git commit -m "Patch 1"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/packing-lists.git
git push -u origin main
```

3. In the repo on GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main, folder: / (root) → Save**.
4. After about 1 minute, the app is at `https://YOUR-USERNAME.github.io/packing-lists/`

## B. Turn on sync (Firebase, free, about 10 minutes)

1. Go to console.firebase.google.com → **Create a project** → name it `packing-lists` → you can turn Google Analytics off → Create.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Authentication → Settings → Authorized domains → Add domain →** `YOUR-USERNAME.github.io`
4. **Build → Firestore Database → Create database →** pick a location near you → **Start in production mode** → Create.
5. In Firestore, open the **Rules** tab. Replace everything with the contents of `firestore.rules` → **Publish**.
6. **Project settings (gear icon) → General → Your apps → Web (`</>`)** → nickname `packing` → Register. Copy the `firebaseConfig = { ... }` block it shows.
7. Open `js/firebase-config.js`. Replace `null` with the block you copied, so it reads `export const firebaseConfig = { apiKey: "...", ... };`
8. Push the change:

```
git add js/firebase-config.js
git commit -m "Add Firebase config"
git push
```

The Firebase config is not a secret. The rules from step 5 protect your data.

## C. Install on your phone

- **iPhone (Safari):** open the link → Share → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Install app** (or Add to Home screen).

Open the app from the home screen icon. Once sync is set up (step B), it asks you to sign in the first time: tap **Create account** on your first device, and **Sign in** on the others. After that, syncing is automatic.

After any update, close the app and open it again **twice** to get the new version.
