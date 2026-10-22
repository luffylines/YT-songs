# Musikero — Feel Every Note 🎧

Premium black-and-emerald **music discovery** web app, deployed from the `dist/` directory with a server-side YouTube search function. Includes a visible, official YouTube player, personal playlists and likes (saved in browser storage), a Latest filter, user-owned audio import, and a lightweight PWA install experience.

## Premium UI design
- Black/emerald luxury theme with dimensional vinyl record artwork, 3D album sleeve, atmospheric lighting and glass-effect surfaces, all made in CSS and SVG.
- Responsive desktop, tablet and phone layouts; accessible buttons, focus rings, and reduced-motion handling.
- A persistent player dock, in-app video player and responsive play queue. The 3D effects are visual only and do not change YouTube playback restrictions.
- App branding, favicon, manifest and PWA cache are updated to **Musikero**.
- Existing users' browser collections migrate from the previous `tambay-v1` key to `musikero-v1` when a change is saved; no playlist reset is required.

## Musikero Free Edition (independent music discovery)

**Status:** Code is implemented, but the independent catalog requires a Jamendo Client ID before live tracks will appear on your Vercel deployment.

- Browse an **independent artist discovery room** with popular tracks, newest releases, search and genre filters. Songs load **40 at a time** (up to **50 pages / 2,000 tracks** available to browse without importing or storing 2,000 MP3s).
- Tap Play to stream from Jamendo through the **native HTML audio element**. The existing Musikero dock, next/previous queue, progress bar and Media Session API support listening outside the page and lock-screen controls where compatible. Browser/OS can still pause background playback; always test on real Android and iOS hardware.
- **Independent favorites** save song IDs and credit metadata to the browser only. Streaming links are resolved again from the provider when a saved favorite is played. This does not store provider songs offline and has no Supabase storage cost.
- New releases are retrieved on demand; not copied to GitHub or permanently synchronized. Provider changes and rights restrictions remain authoritative.
- Every discovered Jamendo song shows **artist credit and a link back** to its Jamendo page. Independent music and YouTube are separate music sources with different permissions.
- Jamendo's free API is for **non-commercial** apps and prohibits apps specifically designed for offline access. It also requires credit, a privacy policy and a distinct experience (not a Jamendo clone). Confirm applicability to your use case before releasing publicly. Do not add advertising, paid plans or a paid tier relying on Jamendo's free API without appropriate permission. The provider can change access, limits or introduce advertising.

### Activate independent music discovery

1. Create a developer account and register **Musikero** as your own non-commercial application at https://devportal.jamendo.com/. Follow Jamendo's approval/registration rules. Your application description must identify the URL where Musikero is published.
2. Find the application's **Client ID** in your own Jamendo developer account.
3. On **Vercel > Musikero project > Settings > Environment Variables**, add `JAMENDO_CLIENT_ID` and paste your Client ID there, then redeploy. Do not put it in `dist/*.js` or commit it.
4. Visit `/api/catalog?page=1&sort=new` on the deployment. You should see track metadata when the provider is available and correctly configured.
5. Open Musikero and select **Independent music** on the sidebar. Test Play, Pause, Next, Queue and lock-screen controls on your Android/iPhone.
6. This version uses **no new Supabase project, tables, or MP3 uploads**. Your existing projects and quotas remain unchanged.

If `JAMENDO_CLIENT_ID` is missing, the independent music panel explains how to configure it instead of pretending that songs are ready to stream.

**Important:** Jamendo terms: https://devportal.jamendo.com/api_terms_of_use and API documentation: https://developer.jamendo.com/v3.0/tracks. Music is not royalty-free in every imaginable use; observe each track's applicable Creative Commons license.

## What it does
- Search current YouTube videos and music releases through YouTube Data API v3.
- Select a result to open the **visible official YouTube player inside Musikero**. The player remains visible above the persistent playback dock; use its controls or the dock to play/pause. It may show YouTube ads. Some videos block embedding and can only be opened on YouTube by clicking the optional link.
- Use the **fixed bottom music dock** with artwork, track title, play/pause, previous/next, progress seek and a song queue. Save videos as favorites or in playlists on the current browser.
- Import **your own audio files** (or properly licensed tracks) from your device for playback using the native HTML audio player, with a download link to the same file. Files stay in browser memory for this tab and are **not** uploaded, stored permanently, or synced.
- Install as a PWA where the browser supports it; the service worker caches only app-shell assets, **not YouTube audio/video**.
- Native audio background playback / lock-screen controls *may* work depending on the phone, OS, and browser; it is not guaranteed. YouTube embeds deliberately stop when the tab becomes hidden or the mobile queue sheet overlays the player.

## Deployment on Vercel
1. Import [this repository](https://github.com/luffylines/YT-songs) into Vercel as a new project.
2. Choose **Other** / no framework; the project contains `vercel.json` setting `outputDirectory: dist`. The API endpoint is `api/search.js`.
3. In **Settings → Environment Variables**, add `YOUTUBE_API_KEY` (not prefixed with `NEXT_PUBLIC_`). Use the credential for YouTube Data API v3, restricted to that API; **do not commit it**. A server-side key may not work if it is restricted to browser HTTP referrers, so use a separate API key for the server with suitable restrictions.
4. Deploy / redeploy after adding the environment variable.
5. Visit `/api/search?q=OPM` on your deployment to check the endpoint.
6. Search in the website. Use **Newest uploads** to see recent videos for the search term; this is *not* a licensed music catalog or guaranteed release-date database.

## Development
`node preview.cjs` serves the static UI at http://localhost:4173. It does not run the Vercel API endpoint. For full-stack local development, install Vercel CLI and use `vercel dev`, with `YOUTUBE_API_KEY` in local environment.
`node test.cjs` runs local sanity checks.

## Important limitations
YouTube's API policy prohibits stripping ads, invisible/background YouTube playback and extracting or downloading YouTube audio/video. This app does not do those things, and owning a YouTube API key does not grant song licenses. For a true ad-free, offline, lock-screen-capable service, obtain a **licensed audio catalog** and serve authorized audio files from storage (for example Supabase Storage or an object-storage/CDN service), using HTML audio and legally permitted downloads. Do not store commercial copyrighted music in this GitHub repo without redistribution rights.

Links: [YouTube API policies](https://developers.google.com/youtube/terms/developer-policies-guide), [Vercel functions](https://vercel.com/docs/functions).
