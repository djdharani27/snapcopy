export type PrintCategoryVisualId = "hall_ticket" | "lab_manual" | "other";

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createHallTicketArt() {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2f160f"/>
          <stop offset="55%" stop-color="#8f3f1f"/>
          <stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="1020" cy="160" r="180" fill="rgba(255,255,255,0.08)"/>
      <circle cx="180" cy="680" r="160" fill="rgba(255,237,213,0.12)"/>
      <rect x="220" y="150" width="760" height="470" rx="36" fill="#fffaf5"/>
      <rect x="220" y="150" width="760" height="110" rx="36" fill="#7c2d12"/>
      <rect x="278" y="205" width="250" height="20" rx="10" fill="#fed7aa"/>
      <rect x="278" y="310" width="430" height="26" rx="13" fill="#9a3412"/>
      <rect x="278" y="360" width="325" height="18" rx="9" fill="#d97706"/>
      <rect x="278" y="415" width="390" height="18" rx="9" fill="#fdba74"/>
      <rect x="278" y="470" width="290" height="18" rx="9" fill="#fdba74"/>
      <rect x="760" y="305" width="150" height="190" rx="20" fill="#ffedd5"/>
      <rect x="786" y="332" width="98" height="98" rx="18" fill="#fb923c"/>
      <rect x="802" y="520" width="70" height="12" rx="6" fill="#c2410c"/>
      <circle cx="410" cy="205" r="11" fill="#fffaf5"/>
      <circle cx="790" cy="205" r="11" fill="#fffaf5"/>
    </svg>
  `);
}

function createLabManualArt() {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="52%" stop-color="#1d4ed8"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="1040" cy="140" r="170" fill="rgba(255,255,255,0.08)"/>
      <circle cx="180" cy="640" r="150" fill="rgba(191,219,254,0.14)"/>
      <rect x="230" y="125" width="720" height="540" rx="34" fill="#eff6ff"/>
      <rect x="230" y="125" width="82" height="540" rx="34" fill="#1e3a8a"/>
      <circle cx="270" cy="210" r="11" fill="#dbeafe"/>
      <circle cx="270" cy="300" r="11" fill="#dbeafe"/>
      <circle cx="270" cy="390" r="11" fill="#dbeafe"/>
      <circle cx="270" cy="480" r="11" fill="#dbeafe"/>
      <rect x="360" y="210" width="360" height="30" rx="15" fill="#1d4ed8"/>
      <rect x="360" y="274" width="480" height="16" rx="8" fill="#60a5fa"/>
      <rect x="360" y="324" width="430" height="16" rx="8" fill="#93c5fd"/>
      <rect x="360" y="374" width="470" height="16" rx="8" fill="#93c5fd"/>
      <rect x="360" y="424" width="390" height="16" rx="8" fill="#93c5fd"/>
      <path d="M770 520c-44-62-32-133 38-172 44 57 31 136-38 172Z" fill="#2563eb"/>
      <path d="M780 512c77-20 121-82 119-160-75 18-121 77-119 160Z" fill="#38bdf8"/>
      <rect x="360" y="524" width="250" height="16" rx="8" fill="#60a5fa"/>
    </svg>
  `);
}

function createOtherPrintArt() {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#231815"/>
          <stop offset="50%" stop-color="#475569"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="1020" cy="130" r="180" fill="rgba(255,255,255,0.08)"/>
      <circle cx="220" cy="690" r="160" fill="rgba(255,255,255,0.1)"/>
      <rect x="210" y="250" width="780" height="300" rx="42" fill="#e2e8f0"/>
      <rect x="300" y="160" width="600" height="150" rx="34" fill="#cbd5e1"/>
      <rect x="350" y="205" width="500" height="32" rx="16" fill="#334155"/>
      <rect x="280" y="320" width="640" height="150" rx="24" fill="#ffffff"/>
      <rect x="310" y="350" width="240" height="18" rx="9" fill="#fb7185"/>
      <rect x="310" y="392" width="300" height="18" rx="9" fill="#38bdf8"/>
      <rect x="640" y="350" width="240" height="18" rx="9" fill="#f59e0b"/>
      <rect x="640" y="392" width="180" height="18" rx="9" fill="#34d399"/>
      <rect x="260" y="530" width="680" height="42" rx="18" fill="#475569"/>
      <rect x="455" y="588" width="290" height="38" rx="18" fill="#1e293b"/>
      <rect x="505" y="630" width="190" height="60" rx="24" fill="#0f172a"/>
    </svg>
  `);
}

export const PRINT_CATEGORY_VISUALS = {
  hall_ticket: {
    imageUrl: createHallTicketArt(),
    icon: "HT",
    subtitle: "Admit card and exam printouts",
  },
  lab_manual: {
    imageUrl: createLabManualArt(),
    icon: "LM",
    subtitle: "Record books and practical manuals",
  },
  other: {
    imageUrl: createOtherPrintArt(),
    icon: "OT",
    subtitle: "Assignments, resumes, and all other prints",
  },
} as const satisfies Record<
  PrintCategoryVisualId,
  {
    imageUrl: string;
    icon: string;
    subtitle: string;
  }
>;
