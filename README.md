# Flemish Tutor

A speaking-first web app for practising everyday Flemish (tussentaal), tuned for Gent.

Pick a scene (bakker, frituur, buur, collega…), listen to three key phrases, then talk your way through it with an AI tutor that answers out loud. New words go into a deck you review by saying them, and the Progress page shows your streak, conversations and learned words.

## Using it

1. Open the site in **Chrome** (speech recognition needs Chrome on Android or desktop).
2. Go to **Settings** and paste an [OpenRouter](https://openrouter.ai/keys) API key. It is stored only in your browser.
3. On Android, install a Dutch voice: *Settings → System → Languages → Text-to-speech → Speech Services by Google*. The app picks a Belgian (nl-BE) voice when one exists.
4. Optional: Chrome menu → *Add to Home screen* to use it like an app.

Progress is stored per device. Use **Settings → Export / Import** to move it.

## How it works

- Static site, no build step: `index.html`, `styles.css`, `js/*.js`.
- Speech: the browser's Web Speech API (`nl-BE`), tap-to-talk because continuous recognition is unreliable on Android Chrome.
- Tutor: a Claude model through OpenRouter's chat completions API, asked to reply in JSON (what to say, translation, new words, one correction).
- Scenes live in `js/scenes.js`; the tutor prompt is in `js/tutor.js`.

Run locally with any static server, e.g. `python3 -m http.server`, then open http://localhost:8000.
