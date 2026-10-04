// Inline SVG icons (no emoji, no font glyphs). Stroke and fill use currentColor.

const svg = body =>
  `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" stroke="none"/>'),
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke-width="1.6"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke-width="1.6"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  fullscreen: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  fullscreenExit: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
};

// Strike marker: red octagon with a cross (filled when used).
export function strikeIcon(used) {
  const fill = used ? '#E5484D' : 'none';
  const stroke = used ? '#FFFFFF' : '#E5484D';
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="${fill}" stroke="#E5484D" stroke-width="2"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

export function starIcon(on, size = 34) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" fill="${on ? '#FFC93C' : '#F1E6D3'}" stroke="#3A2418" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
