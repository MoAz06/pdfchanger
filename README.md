# PDF Editor for GitHub Pages

Static browser-based PDF editor for simple edits.

## Functions
- Upload and preview a PDF in the browser
- Add draggable text overlays
- Add draggable/resizable whiteout rectangles
- Reorder pages with drag and drop
- Export edited PDF

## Important limitation
This is a static GitHub Pages app. Reliable direct editing of existing embedded PDF text is generally not feasible in-browser.  
Use this workflow instead:
1. Place a whiteout rectangle over the original text
2. Add new text on top
3. Export the PDF

## Deploy on GitHub Pages
1. Create a GitHub repository
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Push to the `main` branch
4. Open **Settings → Pages**
5. Under **Build and deployment**, choose **Deploy from a branch**
6. Select:
   - Branch: `main`
   - Folder: `/ (root)`
7. Save

GitHub Pages will publish the site automatically.

## Local testing
You can also just open `index.html` in the browser.  
If a browser blocks module loading from `file://`, run a simple local server, for example:

```bash
python3 -m http.server
```

Then open the shown localhost address.
