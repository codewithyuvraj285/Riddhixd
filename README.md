# Riddhix Technology website

Static site (HTML, CSS, JavaScript + three.js for the 3D hero). No build step needed.

## Put it online with GitHub Pages
1. Create a new repository on GitHub, e.g. `riddhix-website` (public).
2. Upload everything in this folder (index.html, css/, js/, assets/, .nojekyll) to the repository root.
3. Repository Settings -> Pages -> Source: "Deploy from a branch" -> Branch: `main`, folder `/ (root)` -> Save.
4. After a minute the site is live at `https://<your-username>.github.io/riddhix-website/`.

Custom domain: Settings -> Pages -> Custom domain, then add a CNAME record at your domain provider pointing to `<your-username>.github.io`.

## Things to edit
- `js/config.js`: enquiry email, chatbot backend URL, budget and timeline options.
- `index.html`: service text, sector list and footer details.
- `assets/`: logo files cropped from your logo.
- Colors are CSS variables at the top of `css/style.css`.

## Enquiry chatbot (js/chatbot.js)
- Opens as a full-screen chat from the nav ("Chat with AI"), the floating button, the footer and the contact section (any element with `data-chat-open`; `#chat` in the URL also opens it).
- **Guided mode** (default, `chatEndpoint` empty): answers from the site's own content, collects the enquiry, lets the visitor email it. Nothing is saved.
- **AI mode** (endpoints set): the AI converses, and `backend/Code.gs` saves leads, messages and the requirement report to your Google Sheet. Setup: `backend/SETUP.md`.
- Never put API keys or Google credentials in the front-end.

## Languages (js/i18n.js)
English, Hindi, Spanish and Japanese. A selector sits in the header and in the chat; the choice is remembered (`?lang=ja` also works). Page text is translated by exact English match in the `D` dictionary, headings by the `H` blocks (`data-ih`). To change wording, edit the matching row. To add a language, add it to `LANGS`, a value to every `D` row and an entry to every `H` row. Hindi/Japanese load Noto fonts only when selected. The hero heading uses Spectral SC (Latin scripts) with Noto Serif fallbacks for Hindi/Japanese. The AI replies in the visitor's language; the lead summary and report written to the sheet are always English for your team.

## Hero 3D
The 3D scene is auto-fitted to its panel (`FIT` in `js/main.js`). If three.js or WebGL is unavailable, an animated SVG orb is shown instead.

## Tests
`node backend/test/run-tests.js` (backend logic) and `python3 tests/ui-tests.py` (browser, needs Playwright).
## Added pages (multi-page version)
- `about.html`, `solutions.html`, `industries.html`, `blog.html`, `contact.html` and 6 `blog-*.html` posts. The home page (`index.html`) keeps its original design.
- `css/pages.css`: styles for the new pages and the new home sections (classes start with `x-`). `css/style.css` is unchanged.
- `js/pages.js`: menu, carousel and contact form for inner pages. `js/pages-home.js`: carousel arrows on the home page. `js/main.js` is unchanged.
- Inner pages also load `config.js`, `i18n.js` and `chatbot.js`, so the chat and language selector work everywhere. New text is English only until you add rows to the `D` dictionary in `js/i18n.js`.
- Email is `siddhiworki830@gmail.com` (site-wide, in `js/config.js` too). The contact form on `contact.html` opens the visitor's mail app (mailto).
