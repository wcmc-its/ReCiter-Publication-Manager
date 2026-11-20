// Unit tests for the bibliometric report v2 charts (controllers/db/reports/biblioCharts.ts).
// SVG output is compared with committed snapshots in tests/fixtures/charts/ (the three reference
// people from the P1 row fixtures, plus synthetic edge cases). To accept an intended change:
//   UPDATE_CHART_SNAPSHOTS=1 npm test
// then review the .svg diffs (and the PNGs they render to) before committing.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { authorshipByYear, percentileBins } from '../controllers/db/reports/bibliometrics.ts'
import {
    authorshipSvg, percentileSvg, renderPng, textWidth, niceTicks, gapRuns, gapLabel, escapeXml,
    chartFontPath, CHART_FONT_FAMILY, CHART_WIDTH, CHART_HEIGHT, PNG_SCALE, CHART_COLORS,
} from '../controllers/db/reports/biblioCharts.ts'

const FIX = JSON.parse(readFileSync(new URL('./fixtures/bibliometrics-v2-dev-2026-11-11.json', import.meta.url), 'utf8'))
const gouzy = FIX.people.alg2053
const nathan = FIX.people.cnathan
const mirza = FIX.people.aah2003

const UPDATE = process.env.UPDATE_CHART_SNAPSHOTS === '1'
function snapshot(name, svg) {
    const url = new URL(`./fixtures/charts/${name}.svg`, import.meta.url)
    if (UPDATE || !existsSync(url)) {
        writeFileSync(url, svg)
        if (!UPDATE) assert.fail(`snapshot ${name}.svg was missing and has been written; review and re-run`)
        return
    }
    assert.equal(svg, readFileSync(url, 'utf8'), `${name}.svg differs from its snapshot (UPDATE_CHART_SNAPSHOTS=1 to accept)`)
}

const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
const rects = (svg, fill) => [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="([^"]+)"\/>/g)]
    .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], fill: m[5] }))
    .filter((r) => r.fill === fill && !(r.x === 0 && r.y === 0))

let id = 60000000
const ra = (year, role) => ({ pmid: id++, sourceType: 'PUBMED', pubTypeCounted: 1, publicationTypeCanonical: 'Academic Article', pubDate: `${year}-06-01`, researchArticleV2: 1, ratedV2: 0, authorRoleV2: role })

// ---------------------------------------------------------------------------------------------
// Helpers

test('textWidth uses the bundled font advance widths (Arial metrics)', () => {
    assert.equal(textWidth('0', 2048), 1139)
    assert.equal(textWidth('2015–2019', 2048), 9 * 1139)
    assert.equal(textWidth('il', 2048), 910)
    assert.equal(textWidth('é', 2048), 1139, 'unknown glyphs measure as a digit')
})

test('niceTicks: whole-number steps from 0, top tick covers the maximum', () => {
    assert.deepEqual(niceTicks(0), [0, 1])
    assert.deepEqual(niceTicks(2), [0, 1, 2])
    assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8])
    assert.deepEqual(niceTicks(48), [0, 10, 20, 30, 40, 50])
    assert.deepEqual(niceTicks(28.48), [0, 10, 20, 30])
    assert.deepEqual(niceTicks(128), [0, 50, 100, 150])
    for (const m of [1, 3, 9, 11, 23, 86, 99, 250, 999]) {
        const t = niceTicks(m)
        assert.ok(t.at(-1) >= m, `top covers ${m}`)
        assert.ok(t.length - 1 <= 5, `at most 5 intervals for ${m}`)
        assert.ok(t.every(Number.isInteger), `integer ticks for ${m}`)
    }
})

test('escapeXml escapes markup in titles and labels', () => {
    assert.equal(escapeXml(`O'Neil & <Smith> "x"`), 'O&apos;Neil &amp; &lt;Smith&gt; &quot;x&quot;')
    const svg = authorshipSvg(authorshipByYear([ra(2020, 'first')]), { title: 'A & B <c>' })
    assert.ok(svg.includes('<title>A &amp; B &lt;c&gt;</title>'))
    assert.ok(!svg.includes('A & B'))
})

test('gapLabel: the longest text that fits, then a vertical "None"', () => {
    const run = { from: 2, to: 6, first: 2015, last: 2019 }
    assert.deepEqual(gapLabel(run, 300), { text: 'No research articles 2015 to 2019', vertical: false })
    assert.deepEqual(gapLabel({ from: 0, to: 0, first: 2023, last: 2023 }, 200), { text: 'No research articles in 2023', vertical: false })
    assert.deepEqual(gapLabel(run, 100), { text: 'None 2015\u20132019', vertical: false })
    assert.deepEqual(gapLabel(run, 40), { text: 'None', vertical: false })
    assert.deepEqual(gapLabel(run, 20), { text: 'None', vertical: true })
})

// ---------------------------------------------------------------------------------------------
// Authorship over time

test('Gouzy: 2013 to 2025, gaps 2015–2019 and 2023 labeled, bars stacked First/Middle/Senior', () => {
    const chart = authorshipByYear(gouzy)
    const runs = gapRuns(chart)
    assert.deepEqual(runs.map((r) => (r.first === r.last ? String(r.first) : `${r.first}–${r.last}`)), chart.gaps, 'same gaps as P1')
    const svg = authorshipSvg(chart, { title: 'Authorship over time', subtitle: 'Research articles by author role' })
    const t = texts(svg)
    assert.ok(t.includes('No research articles 2015 to 2019'))
    assert.ok(t.includes('None'), 'the one-year 2023 gap is labeled too')
    for (const y of ['2013', '2015', '2019', '2023', '2025']) assert.ok(t.includes(y), `axis shows ${y}`)
    assert.deepEqual(t.filter((s) => ['First', 'Middle', 'Senior'].includes(s)), ['First', 'Middle', 'Senior'], 'legend')
    // 9 research articles: First 4, Middle 3, Senior 2; one rect per non-zero segment.
    const segs = (fill) => rects(svg, fill).filter((r) => !(r.w === 11 && r.h === 11)) // minus the legend swatch
    assert.equal(segs(CHART_COLORS.senior).length, 2)
    const unit = segs(CHART_COLORS.senior)[0].h
    const total = (fill) => Math.round(segs(fill).reduce((a, r) => a + r.h, 0) / unit)
    assert.deepEqual([total(CHART_COLORS.first), total(CHART_COLORS.middle), total(CHART_COLORS.senior)], [4, 3, 2])
    snapshot('authorship-alg2053', svg)
})

test('Nathan: span over 25 years is binned by 5 with two-line range labels', () => {
    const chart = authorshipByYear(nathan)
    const svg = authorshipSvg(chart, { title: 'Authorship over time' })
    const t = texts(svg)
    assert.equal(chart.axis.categories.length, 12)
    assert.ok(t.includes('1971–') && t.includes('1974'), 'first bin split over two lines')
    assert.ok(t.includes('2025–') && t.includes('2026'), 'last bin clipped to the data')
    assert.ok(!t.some((s) => s.startsWith('No research articles')), 'no empty bins')
    snapshot('authorship-cnathan', svg)
})

test('Mirza: 11 years, no gaps, no Senior bars; legend still lists Senior', () => {
    const svg = authorshipSvg(authorshipByYear(mirza))
    assert.equal(rects(svg, CHART_COLORS.senior).length, 1, 'only the legend swatch')
    assert.ok(!texts(svg).includes('None'))
    assert.ok(svg.includes('<title>Authorship over time</title>'), 'default title for the accessible name')
    snapshot('authorship-aah2003', svg)
})

test('Synthetic: 25 one-year categories thin the axis labels and turn a one-year gap label vertical', () => {
    const rows = []
    for (let y = 2000; y <= 2024; y++) if (y !== 2010 && y !== 2015 && y !== 2016) rows.push(ra(y, ['first', 'senior', 'middle'][y % 3]))
    const chart = authorshipByYear(rows)
    assert.equal(chart.axis.binned, false)
    assert.deepEqual(chart.gaps, ['2010', '2015–2016'])
    const svg = authorshipSvg(chart)
    assert.ok(/<text[^>]*transform="rotate\(-90[^>]*>None<\/text>/.test(svg), '2010 gap: vertical None')
    const t = texts(svg)
    assert.ok(t.includes('2000') && t.includes('2002') && !t.includes('2001'), 'every other year labeled')
    snapshot('authorship-synthetic-25y', svg)
})

// ---------------------------------------------------------------------------------------------
// Percentile distribution

test('Nathan: 10 bins as a share of 302 rated, counts above bars, 10% reference line', () => {
    const b = percentileBins(nathan)
    assert.equal(b.shown, true)
    const svg = percentileSvg(b.value, { title: 'Percentile distribution', subtitle: b.text })
    const bars = rects(svg, CHART_COLORS.bar)
    assert.equal(bars.length, 10)
    // heights proportional to counts
    const ratio = bars[9].h / b.value.counts[9]
    bars.forEach((r, i) => assert.ok(Math.abs(r.h - ratio * b.value.counts[i]) < 0.02, `bin ${i}`))
    // the reference line sits at 10% of the rated total
    const ref = svg.match(/<line x1="[\d.]+" y1="([\d.]+)" x2="[\d.]+" y2="[\d.]+" stroke="#C0392B" stroke-width="1.5" stroke-dasharray="5 3"\/>/g)
    assert.equal(ref.length, 2, 'legend swatch + plot line')
    const yRef = +ref[1].match(/y1="([\d.]+)"/)[1]
    const base = bars[0].y + bars[0].h
    assert.ok(Math.abs((base - yRef) - ratio * b.value.total * 0.1) < 0.02, 'line at 10% of rated')
    const t = texts(svg)
    for (const c of b.value.counts) assert.ok(t.includes(String(c)))
    assert.ok(t.includes('10% expected per bin') && t.includes('NIH percentile') && t.includes('90–100'))
    snapshot('percentile-cnathan', svg)
})

test('Mirza: 32 rated, the axis reaches past 10% even when no bin does', () => {
    const b = percentileBins(mirza)
    snapshot('percentile-aah2003', percentileSvg(b.value))
    const flat = percentileSvg({ labels: b.value.labels, counts: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], total: 30 })
    const ticks = texts(flat).filter((s) => /^\d+%$/.test(s))
    assert.ok(ticks.includes('10%'), 'every bin at exactly 10% still shows the 10% tick')
})

test('a count above a bar at the top tick clears the y-axis caption', () => {
    // 10 of 20 in the first bin: the bar reaches the 50% tick right under the caption.
    const svg = percentileSvg({ labels: percentileBins(mirza).value.labels, counts: [10, 2, 1, 1, 1, 1, 1, 1, 1, 1], total: 20 })
    const at = (s) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].find((m) => m[3] === s)
    const caption = at('% of rated research articles')
    const count = at('10')
    assert.ok(caption && count)
    // Cap height of an 11 px label is about 8 px; the count's top must sit below the caption's baseline.
    assert.ok(+count[2] - 8 > +caption[2] + 2, `count baseline ${count[2]} vs caption baseline ${caption[2]}`)
})

// ---------------------------------------------------------------------------------------------
// PNG

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test('renderPng: PNG at 2x, deterministic', () => {
    const svg = authorshipSvg(authorshipByYear(gouzy), { title: 'Authorship over time' })
    const a = renderPng(svg)
    assert.ok(a.data.subarray(0, 8).equals(PNG_SIG))
    assert.deepEqual([a.width, a.height], [CHART_WIDTH * PNG_SCALE, CHART_HEIGHT * PNG_SCALE])
    assert.ok(renderPng(svg).data.equals(a.data), 'same bytes on a second render')
})

test('the bundled font draws text with system fonts off (resvg drops text silently without it)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text x="10" y="28" font-size="24" font-family="${CHART_FONT_FAMILY}">Senior 2015</text></svg>`
    const ink = (font) => {
        const px = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: font ? [font] : [], defaultFontFamily: CHART_FONT_FAMILY } }).render().pixels
        let n = 0
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++
        return n
    }
    assert.equal(ink(null), 0, 'no font: no glyphs')
    assert.ok(ink(chartFontPath()) > 500, 'bundled font: glyphs drawn')
})

test('renderPng throws when the font file is missing instead of rendering without text', () => {
    assert.throws(() => renderPng('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', { fontFile: '/nonexistent/font.ttf' }), /Chart font not found/)
})
