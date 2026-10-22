# Portfolio: setup and everyday use

Your site has two parts:

| Address | What it is |
|---|---|
| `https://<username>.github.io` | The public portfolio |
| `https://<username>.github.io/admin` | Your dashboard and editor. Only your Google account can get in. |

Everything is free and needs no card. You need three free accounts:

- **Firebase** stores your content and your visit stats, and handles the Google sign-in. It uses your Gmail.
- **GitHub** hosts the website.
- **Cloudinary** stores the images and short videos you upload.

The one-time setup takes about 30 minutes. After that, all changes are made in `/admin`, with no code and no Claude.

---

## 0. Try it on your computer (optional)

In this folder, open a terminal and run:

```
python -m http.server 5500
```

Open http://localhost:5500 for the site and http://localhost:5500/admin for the editor. Until Firebase is connected, it runs in **demo mode**: you see starter content and sample stats, and changes are saved only in that browser.

---

## 1. Create the Firebase project

1. Go to **https://console.firebase.google.com** and sign in with your Gmail.
2. Click **Create a project** (or **Add project**). Name it something like `yourname-portfolio`.
3. Turn **Google Analytics** off (you don't need it), then click **Create project**.
4. In the left menu, open **Build › Firestore Database › Create database**.
   - Location: **asia-south1 (Mumbai)**, or the region closest to you. This can't be changed later.
   - Choose **Start in production mode**, then **Create**.
5. In the left menu, open **Build › Authentication › Get started**.
   - Open the **Sign-in method** tab, click **Google › Enable**, pick your email as the support email, then **Save**.
6. Click the gear icon, then **Project settings**. Under **Your apps**, click the **`</>`** (Web) icon.
   - Nickname: `portfolio`. Leave "Firebase Hosting" **unticked**. Click **Register app**.
   - You'll see a block that starts with `const firebaseConfig = {`. Keep this tab open; you'll copy it in step 3.

> The Firebase config is not a secret. It's meant to be public. What protects your site is the database rules (step 4).

## 2. Put the site on GitHub Pages

1. Create a free account at **https://github.com** if you don't have one. Your username becomes your web address.
2. Click **+ › New repository**.
   - Name it exactly **`<your-username>.github.io`**, for example `aadi-edits.github.io`.
   - Set it to **Public**, leave everything else as is, and click **Create repository**.
3. On the new empty repo page, click **uploading an existing file**.
4. Open this `portfolio` folder on your computer, select **everything inside it** (`index.html`, `404.html`, `admin`, `assets`, `data`, `firestore.rules`, `SETUP.md`), and drag it all onto the GitHub page. Wait for the files to finish uploading, then click **Commit changes**.
   - (Or ask Claude once to push it with git. Either way works.)
5. In the repo, go to **Settings › Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: main**, **/ (root)**, then **Save**.
6. Wait 1–2 minutes and open `https://<your-username>.github.io`. Your site is live, still in demo mode.

## 3. Connect the site to Firebase

1. On GitHub, open your repo, go to **assets › js › config.js**, and click the **pencil** (Edit) icon.
2. Replace the line `export const firebaseConfig = null;` with the config you copied in step 1.6. Keep the word `export` and paste only the `{ … }` part:

   ```js
   export const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "yourname-portfolio.firebaseapp.com",
     projectId: "yourname-portfolio",
     storageBucket: "yourname-portfolio.firebasestorage.app",
     messagingSenderId: "…",
     appId: "…"
   };
   ```
3. Click **Commit changes**. The site updates in about a minute.
4. Back in Firebase, go to **Authentication › Settings › Authorized domains › Add domain** and add `<your-username>.github.io`.

## 4. First sign-in and database rules

1. Open `https://<your-username>.github.io/admin` and click **Sign in with Google**.
2. The first time, you'll see **"Almost there"** with a block of rules. Your email is already filled in.
   - Click **Copy rules**.
   - In Firebase, open **Firestore Database › Rules**, select everything, paste, and click **Publish**.
   - Wait about 30 seconds, then press **Reload** on the admin page.
3. You'll see a **Welcome** note with the starter content. Edit anything you like, then press **Save & publish**. Your public site now shows your content.

(The same rules are in `firestore.rules` in this folder, and in **Admin › Settings › Database rules**.)

## 5. Turn on uploads (Cloudinary)

1. Sign up at **https://cloudinary.com** (free plan). Signing in with Google works.
2. On the dashboard, note your **Cloud name**.
3. Click the gear icon (**Settings**), then **Upload › Upload presets › Add upload preset**.
   - **Signing mode: Unsigned**
   - **Asset folder:** `portfolio`
   - Click **Save**, then copy the **preset name**.
4. For PDF résumés: **Settings › Security**, tick **Allow delivery of PDF and ZIP files**, then **Save**.
5. In **Admin › Settings › Uploads**, paste the cloud name and preset name, then press **Save & publish**.

Free limits: images and PDFs up to **10 MB**, videos up to **100 MB**, and about 25 GB of storage plus traffic per month.

---

## Everyday use

### Adding work
**Admin › Work › Add project.** Give it a title and a category, then add media. Every media slot takes either an **upload** or a **pasted link**:

| You have… | Do this |
|---|---|
| Poster, banner, render (image) | **Upload** it |
| Short clip, VFX shot (under 100 MB) | **Upload** it. It plays right on your site. |
| Long edit, short film | Upload to **YouTube** (Unlisted is fine) and paste the link |
| Reel / Short (portrait) | Paste the YouTube Shorts or Instagram reel link, and set **Shape → Portrait 9:16** |
| 3D model | Upload to **Sketchfab** and paste the link. Visitors get a live 3D viewer. |
| Playable game | On itch.io: **Edit game › Distribute › Embed game**, copy the whole `<iframe…>` code and paste it |
| Google Drive file | Set sharing to **Anyone with the link**, then paste the link |

Tips:
- **Shape** sets the card's proportions. Uploads set it automatically.
- Instagram, Sketchfab and itch.io don't provide thumbnails, so add a **Cover image** for those.
- **Before / after slider**: switch it on for VFX breakdowns and upload the plate and the final comp. Use the same size for both. Videos also work, and play in sync.
- **Featured** projects come first and get a star. Turn **Published** off to hide a work-in-progress.
- Text fields understand a few simple formats: a blank line starts a new paragraph, `- ` starts a bullet, `**bold**`, and `[link text](https://…)`.

### Colours
**Admin › Theme.** Pick a preset or set colour A and colour B, adjust the glow, choose a heading font, and turn effects on or off. Under **Colours per section**, any section or work category can have its own pair. Click **Preview** (top right) to watch changes live before publishing.

### Sections, categories, links
- **Categories** are the tabs in Work. You can add new ones like "Photography"; empty ones are hidden.
- **Sections** let you hide, reorder, rename, or add custom text sections (awards, services, clients…).
- **Links**: Instagram, LinkedIn, Behance, ArtStation, email, WhatsApp… Empty links are hidden.

### Visits dashboard
**Admin › Dashboard** shows visits, unique visitors, phone vs PC, where people came from, the most-opened projects, and clicks on your links.
- **Your own visits aren't counted** on any device where you've opened the admin. To make sure your phone is excluded too, open the admin on your phone once, or switch it on in **Settings › Your visits**.
- Use the links in **Settings › Share links**. `?focus=vfx` opens straight to your VFX work, which is good for internship applications. `?ref=instagram` / `?ref=linkedin` tell the dashboard where a visitor came from (Instagram's in-app browser often hides this otherwise).

### Backups
**Settings › Backup › Download backup** saves all your content as a file. **Restore from file** puts it back.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "This address can't sign in yet" | Add your site's domain in Firebase › Authentication › Settings › **Authorized domains**. |
| "Almost there" screen won't go away | The rules weren't published, or the email in them doesn't match the account you signed in with. Copy them again from that screen and **Publish**. |
| "Not allowed to save" | Same as above: re-publish the rules. |
| Upload fails / "Unknown API key" | That message means the **cloud name** is wrong. Use the Cloud name from your Cloudinary dashboard, not the API key. Also check the preset name and that it's **Unsigned**, then press **Test uploads** in Settings. |
| Résumé PDF won't open | Cloudinary › Settings › Security › **Allow delivery of PDF and ZIP files**. Or use a Google Drive link instead. |
| Changes don't show on the site | Reload the page. The site shows a cached copy instantly, then loads the latest. |
| Dashboard says 0 | Visits from `localhost` and from your own devices are skipped on purpose. Try a friend's phone. |

## Free-tier limits (plenty for a portfolio)

| Service | Free limit | What it means for you |
|---|---|---|
| GitHub Pages | 100 GB traffic / month | Thousands of visits; the site itself is tiny |
| Firestore | 50,000 reads + 20,000 writes per day | About 10,000 visits per day |
| Cloudinary | 25 credits / month (≈ 25 GB storage + traffic) | Keep long videos on YouTube |

## Custom domain (optional, costs money for the domain only)
Buy a domain (e.g. `yourname.in`), then in GitHub **Settings › Pages › Custom domain** enter it and follow GitHub's DNS steps. Add the new domain to Firebase **Authorized domains** too.
