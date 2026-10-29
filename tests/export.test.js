const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../export.js'), 'utf8');
function load(overrides = {}) {
  const scope = { ...overrides };
  vm.runInNewContext(source, scope);
  return scope.PatternExport;
}
const identity = [1, 0, 0, 1, 0, 0];
function sampleScene() {
  return [{
    matrix: [0.2, 0, 0, 0.2, 250, 100],
    x: -30, y: -20, width: 400, height: 300,
    clip: [[250, 100], [266, 100], [266, 116], [250, 116]],
    opaque: false,
    runs: [{ matrix: identity, size: 400, x: 20, y: 240,
      chars: [{ character: 'A', x: 0 }, { character: 'V', x: 245 }] }],
  }];
}

test('EPS uses font outlines, measured advances, clip polygons and screen transforms', () => {
  const eps = load().createEPS(sampleScene(), 1200, 800);
  assert.ok(eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0\n'));
  assert.match(eps, /%%BoundingBox: 0 0 1200 800/);
  assert.match(eps, /\/Helvetica-Bold findfont/);
  assert.match(eps, /\(\\101\) true charpath fill/);
  assert.match(eps, /\(\\126\) true charpath fill/);
  assert.match(eps, /250 100 moveto\n266 100 lineto\n266 116 lineto\n250 116 lineto\nclosepath clip/);
  assert.match(eps, /\[0.2 0 0 0.2 250 100\] concat\n-30 -20 translate\n0 0 400 300 rectclip/);
  assert.match(eps, /20 240 translate\n1 -1 scale/);
  assert.match(eps, /gsave 245 0 translate g1 grestore/);
  assert.doesNotMatch(eps, /colorimage|readhexstring|setrgbcolor|\bshow\b/);
  assert.equal((eps.match(/rectfill/g) || []).length, 1); // White page only, no pixel tiles.
  assert.ok(eps.endsWith('%%EOF\n'));
});

test('p5 text capture preserves centering, middle baseline, multiline positions and kerning at high DPI', () => {
  let calls = 0;
  const context = {
    font: 'bold 400px Helvetica', textAlign: 'center', textBaseline: 'middle',
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 400, f: 300 }),
    measureText(text) {
      return { width: text === 'AV' ? 500 : 270,
        actualBoundingBoxAscent: this.textBaseline === 'alphabetic' ? 300 : 100 };
    },
    fillText() { calls++; },
  };
  const original = context.fillText;
  const graphics = { drawingContext: context, pixelDensity: () => 2 };
  load().captureText(graphics, () => {
    context.fillText('AV', 0, 0);
    context.fillText('A', 0, 500);
  });
  assert.equal(calls, 2);
  assert.equal(context.fillText, original);
  assert.equal(context.textBaseline, 'middle');
  const [first, second] = graphics.outlineRuns;
  assert.deepEqual(Array.from(first.matrix), [1, 0, 0, 1, 200, 150]);
  assert.equal(first.x, -250);
  assert.equal(first.y, 200);
  assert.equal(first.chars[1].x, 230); // Browser AV kerning rather than A + V widths.
  assert.equal(second.y, 700);
});

test('text capture restores the drawing context if drawing fails', () => {
  const original = () => {};
  const context = { fillText: original };
  assert.throws(() => load().captureText({ drawingContext: context }, () => { throw new Error('test'); }));
  assert.equal(context.fillText, original);
});

test('EPS encodes special punctuation safely and rejects unsupported fallback glyphs', () => {
  const scene = sampleScene();
  scene[0].runs[0].chars = Array.from('()\\é€—').map((character, x) => ({ character, x }));
  const eps = load().createEPS(scene, 800, 600);
  assert.match(eps, /\(\\050\) true charpath/);
  assert.match(eps, /\(\\051\) true charpath/);
  assert.match(eps, /\(\\134\) true charpath/);
  assert.match(eps, /\(\\351\) true charpath/);
  assert.match(eps, /PatternEncoding 128 \/Euro put/);
  scene[0].runs[0].chars = [{ character: '한', x: 0 }];
  assert.throws(() => load().createEPS(scene, 800, 600), /Unsupported character: 한/);
});

test('EPS takes the recorded frame without reading pixels; PNG is 2000px with the same aspect ratio', async () => {
  for (const imageMode of [false, true]) {
    let blob, filename;
    let copied = 0;
    let createdCanvas = 0;
    const canvas = { width: 12, height: 8 };
    const snapshot = {
      getContext: () => ({
        fillRect() {},
        drawImage(input) { assert.equal(input, canvas); copied++; },
        getImageData() { throw new Error('Pixel tracing must not be used.'); },
      }),
      toBlob(callback, type) { assert.equal(type, 'image/png'); callback(new Blob(['PNG'], { type })); },
    };
    const link = { click() { filename = this.download; }, remove() {} };
    const api = load({
      Blob,
      URL: { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL() {} },
      setTimeout() {},
      document: {
        createElement(name) { if (name === 'canvas') { createdCanvas++; return snapshot; } return link; },
        body: { appendChild() {} },
      },
    });
    await api.exportCanvas(canvas, { imageMode, width: 6, height: 4, scene: sampleScene() });
    if (imageMode) {
      assert.equal(copied, 1);
      assert.equal(snapshot.width, 2000);
      assert.equal(snapshot.height, 1333);
      assert.equal(blob.type, 'image/png');
      assert.match(filename, /\.png$/);
    } else {
      assert.equal(copied, 0);
      assert.equal(createdCanvas, 0);
      assert.equal(blob.type, 'application/postscript');
      assert.match(filename, /\.eps$/);
      assert.match(await blob.text(), /true charpath fill/);
    }
  }
});
