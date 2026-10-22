# Tambay Music 🎵

Spotify-inspired **music discovery** web app, deployed from the `dist/` directory with a server-side YouTube search function. Includes a visible, official YouTube player, personal playlists and likes (saved in browser storage), a Latest filter, user-owned audio import, and a lightweight PWA install experience.

## What it does
- Search current YouTube videos and music releases through YouTube Data API v3.
- Select a result to open the **visible official YouTube player inside Tambay**. The player remains visible above the persistent playback dock; use its controls or the dock to play/pause. It may show YouTube ads. Some videos block embedding and can only be opened on YouTube by clicking the optional link.
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
