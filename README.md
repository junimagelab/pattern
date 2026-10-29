# Interactive Text & Image Effects

A p5.js-based interactive web application that allows users to apply various visual effects to text and images in a grid layout.

## Features

- **Text & Image Support**: Switch between text input and image upload
- **Real-time Effects**:
  - Size adjustment
  - Horizontal shift (spread/gather effect)
  - Italic angle (shear transformation)
  - Vertical shift (stretch/compress effect)
- **Interactive Controls**: Easy-to-use sliders and file input
- **Grid Layout**: Effects applied across multiple positions

## How to Use

1. Open `index.html` in a web browser
2. Enter text or upload an image using "Choose File"
3. Use the sliders to adjust various effects:
   - **Size**: Change the overall size
   - **Horizontal Shift**: Create spread/gather effects
   - **Italic Angle**: Apply shear transformation
   - **Vertical Shift**: Stretch or compress vertically
4. Toggle between text and image modes using the button

## Export

- The Instagram link below the copyright opens `https://www.instagram.com/dongjun.obj/`.
- **Export** saves the current canvas frame without the controls. Animation is captured at the moment of the click.
- Text mode downloads an **EPS** with the current screen dimensions. It records the actual text layout and transforms before rasterization, and uses Helvetica Bold's PostScript `charpath` outlines for smooth edges. Clipping, rotation, compression, spacing, multiline layout and the displayed animation frame are preserved. The EPS reader must provide Helvetica Bold; the font itself is not embedded. Western characters (Latin-1 and common European punctuation) are supported; unsupported fallback characters produce an explicit error rather than pixel tracing or missing glyphs.
- Image mode downloads a **PNG** at **2000px wide**, keeping the current canvas aspect ratio. The current frame is resized; exporting does not change the on-screen layout.
- Export verification: `node --test tests/export.test.js`.
- The footer description uses its natural height so the full paragraph is visible. The second dotted rule, copyright, Instagram link and Export follow it with compact spacing.

## Technologies Used

- p5.js for graphics and interaction
- HTML5 Canvas for rendering
- JavaScript for effect calculations

## Files

- `index.html` - Main HTML file
- `sketch.js` - Main p5.js application code
- `style.css` - Styling
- `libraries/` - p5.js library files

## Live Demo

Open `index.html` in your browser to see the interactive effects in action!

## Publish (GitHub Pages)

This project is a static site (plain HTML/CSS/JS), so it can be published as-is.

### Option A) GitHub Pages via Actions (already configured)

This repo now includes a workflow at `.github/workflows/pages.yml`.

1. Push this repository to GitHub (branch name: `main`)
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. Push to `main` (or run the workflow manually). After the workflow finishes, GitHub will show the Pages URL.

### Option B) GitHub Pages from a branch (no Actions)

1. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**
2. Select branch `main` and folder `/ (root)`

### Local preview (recommended)

Some browsers restrict certain features when opening a file directly. A tiny local server avoids that.

From this folder:

- `python3 -m http.server 8000`
- Open `http://localhost:8000/`

---

## 퍼블리시(배포) 요약 (Korean)

- 이 프로젝트는 정적 사이트라서 그대로 GitHub Pages에 올릴 수 있어요.
- GitHub에서 **Settings → Pages**로 가서 Source를 **GitHub Actions**(또는 branch)로 설정하면 배포됩니다.
