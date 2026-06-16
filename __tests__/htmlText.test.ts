/**
 * Unit tests for the inline-HTML sanitizer used to render PubMed markup in
 * article titles/journals (issue #750). Verifies the security boundary:
 * only attribute-free inline formatting survives; everything else is dropped.
 */
import { sanitizeInlineHtml, stripHtml } from '../src/utils/htmlText';

describe('sanitizeInlineHtml', () => {
  it('renders allowed inline formatting tags', () => {
    expect(sanitizeInlineHtml('Variations in <i>KIAA0319L</i>, encoding AAVR'))
      .toBe('Variations in <i>KIAA0319L</i>, encoding AAVR');
    expect(sanitizeInlineHtml('H<sub>2</sub>O and E=mc<sup>2</sup>'))
      .toBe('H<sub>2</sub>O and E=mc<sup>2</sup>');
    expect(sanitizeInlineHtml('<b>bold</b> <em>em</em> <strong>s</strong>'))
      .toBe('<b>bold</b> <em>em</em> <strong>s</strong>');
  });

  it('strips attributes from allowed tags (no event handlers survive)', () => {
    expect(sanitizeInlineHtml('<i onclick="steal()">x</i>')).toBe('<i>x</i>');
    expect(sanitizeInlineHtml('<i class="x" style="color:red">y</i>')).toBe('<i>y</i>');
  });

  it('drops disallowed tags entirely but keeps their text', () => {
    expect(sanitizeInlineHtml('a<script>alert(1)</script>b')).toBe('aalert(1)b');
    expect(sanitizeInlineHtml('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeInlineHtml('<a href="javascript:alert(1)">link</a>')).toBe('link');
    expect(sanitizeInlineHtml('<div><p>hi</p></div>')).toBe('hi');
  });

  it('leaves entities and plain text untouched', () => {
    expect(sanitizeInlineHtml('Tom &amp; Jerry')).toBe('Tom &amp; Jerry');
    expect(sanitizeInlineHtml('plain title')).toBe('plain title');
  });

  it('handles null/undefined/empty', () => {
    expect(sanitizeInlineHtml(undefined)).toBe('');
    expect(sanitizeInlineHtml(null)).toBe('');
    expect(sanitizeInlineHtml('')).toBe('');
  });
});

describe('stripHtml', () => {
  it('removes tags and decodes common entities', () => {
    expect(stripHtml('Variations in <i>KIAA0319L</i>')).toBe('Variations in KIAA0319L');
    expect(stripHtml('H<sub>2</sub>O')).toBe('H2O');
    expect(stripHtml('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3');
    expect(stripHtml('&#65;&#x42;C')).toBe('ABC');
  });

  it('handles null/undefined/empty', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml('')).toBe('');
  });
});
