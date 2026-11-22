# Repository decks

Every `.json` file in this folder (including subfolders) shows up on the flashcards home page in the “Ready-to-use flashcards” section. No import needed.

1. In the app, open a deck and choose **More → Export to JSON**, or write the file by hand (the format is described in the main README).
2. Put the file here, e.g. `decks/materials-science.json` or `decks/semester-3/physics.json`.
3. Commit and push to `main`. After deployment the deck appears on the site.

Locally (`npm run dev`) new files appear after reloading the page.

The deck's address depends on the file name, so don't rename it without a reason. Editing such a deck in the app is saved only in your browser. **More → Restore repository version** removes the local changes.
