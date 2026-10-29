/* Export the visible canvas frame, without DOM controls or advancing animation. */
(function (root) {
  'use strict';

  // Record p5's actual fillText calls before they become bitmap buffers. This
  // retains line layout, browser kerning, baseline placement and font size.
  function matrix(context, density = 1) {
    const m = context.getTransform();
    return [m.a, m.b, m.c, m.d, m.e, m.f].map(value => value / density);
  }

  function captureText(graphics, drawText) {
    const context = graphics.drawingContext;
    const original = context.fillText;
    const runs = [];
    graphics.outlineRuns = runs;
    context.fillText = function (text, x, y) {
      const metrics = context.measureText(text);
      const baseline = context.textBaseline;
      context.textBaseline = 'alphabetic';
      const alphabetic = context.measureText(text);
      context.textBaseline = baseline;
      const align = context.textAlign;
      const left = x - (align === 'center' ? metrics.width / 2 :
        (align === 'right' || align === 'end') ? metrics.width : 0);
      const chars = [];
      let prefix = '';
      for (const character of text) {
        prefix += character;
        chars.push({ character, x: context.measureText(prefix).width - context.measureText(character).width });
      }
      runs.push({
        matrix: matrix(context, graphics.pixelDensity()),
        size: Number(/([\d.]+)px/.exec(context.font)[1]),
        x: left,
        y: y + alphabetic.actualBoundingBoxAscent - metrics.actualBoundingBoxAscent,
        chars,
      });
      return original.apply(context, arguments);
    };
    try { drawText(); } finally { context.fillText = original; }
  }

  function clipRect(context, density, x, y, width, height) {
    const [a, b, c, d, e, f] = matrix(context, density);
    return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
      .map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
  }

  function captureImage(scene, context, density, graphics, x, y, clip = null) {
    if (!graphics.outlineRuns) return;
    scene.push({
      matrix: matrix(context, density), x, y,
      width: graphics.width, height: graphics.height,
      opaque: Boolean(graphics.outlineOpaque),
      runs: graphics.outlineRuns,
      clip,
    });
  }

  // Helvetica is the same PostScript family used by the screen's textFont.
  // charpath obtains its genuine Bezier outlines; no pixels are read or traced.
  // ISO Latin-1 plus the standard Windows punctuation covers Western text.
  const extraCharacters = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const extraNames = ['Euro', 'quotesinglbase', 'florin', 'quotedblbase', 'ellipsis',
    'dagger', 'daggerdbl', 'circumflex', 'perthousand', 'Scaron', 'guilsinglleft',
    'OE', 'Zcaron', 'quoteleft', 'quoteright', 'quotedblleft', 'quotedblright',
    'bullet', 'endash', 'emdash', 'tilde', 'trademark', 'scaron', 'guilsinglright',
    'oe', 'zcaron', 'Ydieresis'];

  function characterCode(character) {
    const code = character.codePointAt(0);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return code;
    const extra = extraCharacters.indexOf(character);
    if (extra >= 0) return 128 + extra;
    throw new Error(`EPS outlines currently support Helvetica's Western characters. Unsupported character: ${character}`);
  }

  function createEPS(scene, pageWidth, pageHeight) {
    const n = value => {
      if (!Number.isFinite(value)) throw new Error('Invalid export geometry.');
      return Number(value.toFixed(8)).toString();
    };
    const transform = values => `[${values.map(n).join(' ')}] concat`;
    const parts = [
      '%!PS-Adobe-3.0 EPSF-3.0',
      `%%BoundingBox: 0 0 ${Math.ceil(pageWidth)} ${Math.ceil(pageHeight)}`,
      `%%HiResBoundingBox: 0 0 ${n(pageWidth)} ${n(pageHeight)}`,
      '%%Title: Pattern outlines',
      '%%Creator: Pattern font outline export',
      '%%DocumentNeededResources: font Helvetica-Bold',
      '%%LanguageLevel: 2', '%%Pages: 1', '%%EndComments',
      '%%BeginProlog',
      '/PatternEncoding ISOLatin1Encoding 256 array copy def',
      // Avoid the legacy quote substitutions in the standard encoding.
      'PatternEncoding 39 /quotesingle put',
      'PatternEncoding 96 /grave put',
      ...extraNames.map((name, index) => `PatternEncoding ${128 + index} /${name} put`),
      '/Helvetica-Bold findfont dup length dict begin',
      '{1 index /FID ne {def} {pop pop} ifelse} forall',
      '/Encoding PatternEncoding def',
      'currentdict end /PatternHelvetica exch definefont pop',
      '%%EndProlog',
      'gsave',
      `0 0 ${n(pageWidth)} ${n(pageHeight)} rectclip`,
      '1 setgray', `0 0 ${n(pageWidth)} ${n(pageHeight)} rectfill`,
      `0 ${n(pageHeight)} translate`, '1 -1 scale',
    ];
    // Define reusable character outlines at the origin. Each use is a smooth
    // font path, positioned using the browser's measured character advances.
    const glyphs = new Map();
    for (const image of scene) {
      for (const run of image.runs) {
        for (const glyph of run.chars) {
          const code = characterCode(glyph.character);
          const key = `${run.size}:${code}`;
          if (glyphs.has(key)) continue;
          const name = `g${glyphs.size}`;
          glyphs.set(key, name);
          const octal = code.toString(8).padStart(3, '0');
          parts.push(`/${name} { /PatternHelvetica findfont ${n(run.size)} scalefont setfont newpath 0 0 moveto (\\${octal}) true charpath fill } bind def`);
        }
      }
    }
    for (const image of scene) {
      parts.push('gsave');
      if (image.clip) {
        const [first, ...rest] = image.clip;
        parts.push('newpath', `${first.map(n).join(' ')} moveto`,
          ...rest.map(point => `${point.map(n).join(' ')} lineto`), 'closepath clip newpath');
      }
      parts.push(transform(image.matrix), `${n(image.x)} ${n(image.y)} translate`,
        `0 0 ${n(image.width)} ${n(image.height)} rectclip`);
      if (image.opaque) parts.push('1 setgray', `0 0 ${n(image.width)} ${n(image.height)} rectfill`);
      parts.push('0 setgray');
      for (const run of image.runs) {
        parts.push('gsave', transform(run.matrix), `${n(run.x)} ${n(run.y)} translate`, '1 -1 scale');
        for (const glyph of run.chars) {
          const name = glyphs.get(`${run.size}:${characterCode(glyph.character)}`);
          parts.push(`gsave ${n(glyph.x)} 0 translate ${name} grestore`);
        }
        parts.push('grestore');
      }
      parts.push('grestore');
    }
    parts.push('grestore', 'showpage', '%%EOF');
    return parts.join('\n') + '\n';
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Leave time for the browser to consume the download before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportCanvas(canvas, { imageMode, width, height, scene }) {
    if (!canvas || !width || !height) throw new Error('No canvas to export.');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (!imageMode) {
      if (!scene) throw new Error('The outline frame is not ready. Please try again.');
      const eps = createEPS(scene, width, height);
      download(new Blob([eps], { type: 'application/postscript' }), `pattern-${timestamp}.eps`);
      return;
    }
    const snapshot = document.createElement('canvas');
    snapshot.width = 2000;
    snapshot.height = Math.max(1, Math.round(2000 * height / width));
    const context = snapshot.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, snapshot.width, snapshot.height);
    context.drawImage(canvas, 0, 0, snapshot.width, snapshot.height);
    const blob = await new Promise((resolve, reject) => {
      snapshot.toBlob(result => result ? resolve(result) : reject(new Error('PNG encoding failed.')), 'image/png');
    });
    download(blob, `pattern-${timestamp}.png`);
  }

  root.PatternExport = { matrix, captureText, clipRect, captureImage, createEPS, exportCanvas };
})(typeof window === 'undefined' ? globalThis : window);
