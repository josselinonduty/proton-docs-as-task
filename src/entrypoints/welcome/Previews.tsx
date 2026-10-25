import type { Layout } from '@/lib/onboarding';

/** Decorative miniature of a layout; the card's text carries the meaning. */
export function LayoutPreview({ layout }: { layout: Layout }) {
  return (
    <svg className="wl-preview" viewBox="0 0 120 72" aria-hidden="true" focusable="false">
      {layout === 'list' && <ListShape />}
      {layout === 'board' && <BoardShape />}
      {layout === 'swimlanes' && <SwimlanesShape />}
    </svg>
  );
}

const ROWS = [64, 48, 56, 40];

function ListShape() {
  return (
    <>
      {ROWS.map((width, i) => (
        <g key={i} transform={`translate(8 ${8 + i * 15})`}>
          <rect className="wl-shape-card" x="0" y="0" width="104" height="11" rx="3" />
          <rect className="wl-shape-box" x="4" y="2.5" width="6" height="6" rx="1.5" />
          <rect className="wl-shape-line" x="15" y="4" width={width} height="3" rx="1.5" />
          <rect className="wl-shape-accent" x="90" y="4" width="10" height="3" rx="1.5" />
        </g>
      ))}
    </>
  );
}

const COLUMN_X = [6, 44, 82];
const CARDS_PER_COLUMN = [3, 2, 1];

function BoardShape() {
  return (
    <>
      {COLUMN_X.map((x, col) => (
        <g key={x} transform={`translate(${x} 6)`}>
          <rect className="wl-shape-col" width="32" height="60" rx="4" />
          <rect className="wl-shape-accent" x="4" y="4" width="14" height="3" rx="1.5" />
          {Array.from({ length: CARDS_PER_COLUMN[col]! }, (_, card) => (
            <rect
              key={card}
              className="wl-shape-card"
              x="4"
              y={12 + card * 16}
              width="24"
              height="13"
              rx="3"
            />
          ))}
        </g>
      ))}
    </>
  );
}

const LANE_Y = [6, 38];

function SwimlanesShape() {
  return (
    <>
      {LANE_Y.map((y, lane) => (
        <g key={y} transform={`translate(0 ${y})`}>
          <rect className="wl-shape-col" x="6" width="108" height="28" rx="4" />
          <rect className="wl-shape-accent" x="10" y="4" width="12" height="3" rx="1.5" />
          {COLUMN_X.map((x, col) => (
            <rect
              key={x}
              className={(lane + col) % 2 === 0 ? 'wl-shape-card' : 'wl-shape-line'}
              x={x + 4}
              y="11"
              width="24"
              height="12"
              rx="3"
              opacity={(lane + col) % 2 === 0 ? 1 : 0.5}
            />
          ))}
        </g>
      ))}
    </>
  );
}
