const P: Record<string, React.ReactNode> = {
  logo: (
    <>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  pan: <path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-6.5v-1a1.5 1.5 0 013 0V12m0-6a1.5 1.5 0 013 0v6m0-3.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-4.9-2.6L4.3 14.3a1.6 1.6 0 012.5-2L8 13.5" />,
  select: <path d="M5 3l14 8-6 1.5L10 19z" />,
  pen: (
    <>
      <path d="M4 20c3-1 4-3 6-6s4-6 6-7 3 0 3 2-2 3-4 3-4 1-5 3" />
    </>
  ),
  line: <path d="M5 19L19 5" />,
  arrow: (
    <>
      <path d="M5 19L19 5" />
      <path d="M10 5h9v9" />
    </>
  ),
  rect: <rect x="4" y="6" width="16" height="12" rx="1" />,
  ellipse: <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />,
  polygon: <path d="M5 8l7-4 7 5-2 9H7z" />,
  text: (
    <>
      <path d="M5 6V4h14v2M12 4v16M9 20h6" />
    </>
  ),
  symbol: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  eraser: (
    <>
      <path d="M16 3.5l4.5 4.5-10 10H6l-2.5-2.5z" />
      <path d="M10.5 9l4.5 4.5M10 20h10" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13" />,
  download: <path d="M12 4v11m-5-5l5 5 5-5M5 20h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </>
  ),
  "chev-right": <path d="M9 5l7 7-7 7" />,
  "chev-left": <path d="M15 5l-7 7 7 7" />,
};

export function Icon({ name }: { name: string }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}
