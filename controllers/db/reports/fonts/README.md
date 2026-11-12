# Chart font

`LiberationSans-Regular.ttf` is Liberation Sans 2.1.5 (Red Hat), licensed under the SIL Open Font
License 1.1 (`LiberationSans-LICENSE.txt`). It is metric-compatible with Arial.

Source: https://github.com/liberationfonts/liberation-fonts/releases (liberation-fonts-ttf-2.1.5.tar.gz)
SHA-256: 76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8

`biblioCharts.ts` renders the bibliometric report charts with resvg, system fonts off and only this
file, so the PNGs are the same on a Mac and on the node:22-alpine runner (which has no fonts). Its
advance widths are copied into `biblioCharts.ts` (`ASCII_ADVANCE`) for layout; replace both together.
The Dockerfile copies this directory into the runner image.
