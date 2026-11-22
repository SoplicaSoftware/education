import type { Card, Deck } from '../types'
import { uid } from './utils'

const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`

const INCLINED_PLANE = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 320 200">
<rect width="320" height="200" fill="#ffffff"/>
<polygon points="20,180 300,180 300,40" fill="#e0e7ff" stroke="#3730a3" stroke-width="2"/>
<g transform="rotate(-26.6 170 110)"><rect x="140" y="80" width="56" height="34" fill="#4f46e5" rx="3"/></g>
<line x1="170" y1="112" x2="170" y2="170" stroke="#dc2626" stroke-width="3" marker-end="url(#a)"/>
<defs><marker id="a" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#dc2626"/></marker></defs>
<text x="178" y="166" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#dc2626">mg</text>
<path d="M70,180 A50,50 0 0 0 66,158" fill="none" stroke="#3730a3" stroke-width="2"/>
<text x="78" y="172" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#3730a3">&#945;</text>
</svg>`)

function pearliteSvg() {
  const grains = [
    { pts: '0,0 130,0 110,90 0,110', angle: 35 },
    { pts: '130,0 260,0 240,70 110,90', angle: -20 },
    { pts: '260,0 320,0 320,120 240,70', angle: 70 },
    { pts: '0,110 110,90 150,200 0,200', angle: -55 },
    { pts: '110,90 240,70 320,120 320,200 150,200', angle: 10 },
  ]
  const defs = grains
    .map(
      (g, i) =>
        `<pattern id="p${i}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(${g.angle})"><rect width="9" height="9" fill="#e9e4da"/><rect width="9" height="3" fill="#3f3a33"/></pattern>`,
    )
    .join('')
  const shapes = grains
    .map((g, i) => `<polygon points="${g.pts}" fill="url(#p${i})" stroke="#1c1917" stroke-width="2"/>`)
    .join('')
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 320 200"><defs>${defs}</defs>${shapes}</svg>`)
}

const card = (front: string, back: string, extra: Partial<Card> = {}): Card => ({
  id: uid(),
  front: { text: front },
  back: { text: back },
  choices: [],
  ...extra,
})

export function createSampleDeck(): Deck {
  const now = Date.now()
  return {
    id: uid(),
    title: 'Przykład: fizyka i materiałoznawstwo',
    description: 'Zestaw demonstracyjny pokazujący LaTeX, zdjęcia i pytania z wieloma poprawnymi odpowiedziami.',
    createdAt: now,
    updatedAt: now,
    cards: [
      card('II zasada dynamiki Newtona', '$\\vec F = m\\vec a$'),
      card('Energia kinetyczna ciała o masie $m$ i prędkości $v$', '$E_k = \\dfrac{mv^2}{2}$'),
      card(
        'Co to za mikrostruktura? (stal eutektoidalna, wolno chłodzona)',
        'Perlit – płytkowa mieszanina ferrytu $\\alpha$ i cementytu $\\mathrm{Fe_3C}$',
        { front: { text: 'Co to za mikrostruktura? (stal eutektoidalna, wolno chłodzona)', image: pearliteSvg() } },
      ),
      card('Podaj siłę zsuwającą klocek z równi pochyłej (bez tarcia).', '$F = mg\\sin\\alpha$', {
        front: { text: 'Podaj siłę zsuwającą klocek z równi pochyłej (bez tarcia).', image: INCLINED_PLANE },
      }),
      card('Zawartość węgla w punkcie eutektoidalnym układu Fe–Fe₃C', '$0{,}77\\%\\,\\mathrm{C}$ (ok. $727^\\circ\\mathrm{C}$)'),
      card('Prawo Hooke’a (naprężenie–odkształcenie)', '$$\\sigma = E\\,\\varepsilon$$'),
      card('Które z poniższych są fazami w układzie Fe–Fe₃C?', '', {
        choices: [
          { id: uid(), text: 'Ferryt $\\alpha$', correct: true },
          { id: uid(), text: 'Austenit $\\gamma$', correct: true },
          { id: uid(), text: 'Cementyt $\\mathrm{Fe_3C}$', correct: true },
          { id: uid(), text: 'Perlit', correct: false },
        ],
      }),
      card('Równanie Bernoulliego (przepływ ustalony, nielepki)', '$$p + \\frac{\\rho v^2}{2} + \\rho g h = \\text{const}$$'),
    ],
  }
}
