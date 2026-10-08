# Plan Companion presentation

Open `public/presentation.html` directly in a browser, or visit `/presentation.html` on the running app. The generated file is self-contained: images, styles and navigation work offline.

The app header's **Project story** link opens the deck in a new tab, keeping the current chatbot conversation available. The hosted deck includes **Back to chat**; this link is hidden when opening the HTML as an offline file. The production build regenerates the deck automatically, so it is included in the app's normal Vercel deployment.

- Four slides: development, refinement, road to production, features.
- Slide 3 intentionally contains only its title.
- Use the bottom controls or Left/Right arrows to navigate; Home/End jump to the first/last slide.
- Click a diagram or feature screenshot to enlarge it; Escape closes the enlarged image.
- Full screen is available in supported browsers. Print / PDF prints all four slides in landscape.

Edit `deck.template.html`, then run `npm run build:presentation` from the repository root (or `npm run build` for the full production build). The template also opens directly alongside its `assets` folder.

The two process PNGs are unchanged copies of the supplied diagrams. The six feature PNGs are captures of the actual local app on 8 October 2026. The simple-language answer was generated through the app with its real provider; the optional priority text is a demonstration example. No simulated responses or reconstructed UI are used. Language simplicity describes the effect of Very simple mode; complexity control describes the selector for all three modes.
