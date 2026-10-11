# Plan Companion presentation

Open `public/presentation.html` directly in a browser, or visit `/presentation.html` on the running app. The generated file is self-contained: images, styles and navigation work offline.

The app header's **Project story** link opens the deck in a new tab, keeping the current chatbot conversation available. The hosted deck includes **Back to chat**; this link is hidden when opening the HTML as an offline file. The production build regenerates the deck automatically, so it is included in the app's normal Vercel deployment.

- Four slides: development, refinement, road to production, features.
- Slide 3 covers five production workstreams, provisional capacity targets and the supplied handmade roadmap, with click-to-enlarge support.
- Use the bottom controls or Left/Right arrows to navigate; Home/End jump to the first/last slide.
- Click a diagram or feature screenshot to enlarge it; Escape closes the enlarged image.
- Full screen is available in supported browsers. Print / PDF prints all four slides in landscape.

Edit `deck.template.html`, then run `npm run build:presentation` from the repository root (or `npm run build` for the full production build). The template also opens directly alongside its `assets` folder.

Slide 3's research, current-app assessment, traffic calculations, provider constraints and speaker notes are in [road-to-production.md](road-to-production.md). The exact drawing instructions are in [handmade-roadmap-brief.md](handmade-roadmap-brief.md). Capacity numbers are planning scenarios, not tested deployment limits. Research reviewed on 8 October 2026; confirm current account settings and provider limits before implementation.

The three process and roadmap PNGs are unchanged copies of the supplied diagrams. Slide 4 covers plan selection, the Hindi–English toggle, complexity control, optional goals, live conversation, and voice measurements and review. The two voice features are highlighted. The first four feature PNGs were captured from the actual local app on 8 October 2026; the live conversation and expanded measurements panel were captured on 11 October 2026. The optional priority text is a demonstration example. The measurements panel shows its initial state, with no recorded timings or reviews. No simulated responses or reconstructed UI are used.
