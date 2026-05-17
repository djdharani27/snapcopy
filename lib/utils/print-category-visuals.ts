export type PrintCategoryVisualId = "hall_ticket" | "lab_manual" | "other";

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
    imageUrl:
      "https://tse2.mm.bing.net/th/id/OIP.sN0IC5PlrnipYgj11n6eigHaDr?pid=Api&P=0&h=180",
    icon: "HT",
    subtitle: "Admit card and exam printouts",
  },
  lab_manual: {
    imageUrl:
      "https://tse4.mm.bing.net/th/id/OIP.Ban23Rv3svXhoxEWRoAs3wHaFj?pid=Api&P=0&h=180",
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
