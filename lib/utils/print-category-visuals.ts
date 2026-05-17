export type PrintCategoryVisualId = "hall_ticket" | "lab_manual" | "other";

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createOtherPrintArt() {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="60%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)"/>
      <circle cx="1020" cy="140" r="190" fill="rgba(255,255,255,0.08)"/>
      <circle cx="180" cy="650" r="170" fill="rgba(249,115,22,0.14)"/>
      <rect x="250" y="90" width="580" height="640" rx="48" fill="#f8fafc"/>
      <path d="M720 90h110v110" fill="#cbd5e1"/>
      <path d="M720 90 830 200H720Z" fill="#e2e8f0"/>
      <rect x="340" y="190" width="250" height="20" rx="10" fill="#94a3b8"/>
      <rect x="340" y="238" width="350" height="18" rx="9" fill="#cbd5e1"/>
      <rect x="340" y="284" width="280" height="18" rx="9" fill="#cbd5e1"/>
      <circle cx="540" cy="430" r="190" fill="#fff7ed"/>
      <circle cx="540" cy="430" r="158" fill="#f97316"/>
      <rect x="485" y="250" width="110" height="360" rx="32" fill="#ffffff"/>
      <rect x="360" y="375" width="360" height="110" rx="32" fill="#ffffff"/>
      <rect x="410" y="620" width="260" height="18" rx="9" fill="#cbd5e1"/>
    </svg>
  `);
}

export const PRINT_CATEGORY_VISUALS = {
  hall_ticket: {
    imageUrl:
      "https://tse2.mm.bing.net/th/id/OIP.sN0IC5PlrnipYgj11n6eigHaDr?pid=Api&P=0&h=180",
    icon: "",
    subtitle: "Admit card and exam printouts",
  },
  lab_manual: {
    imageUrl:
      "https://tse4.mm.bing.net/th/id/OIP.Ban23Rv3svXhoxEWRoAs3wHaFj?pid=Api&P=0&h=180",
    icon: "",
    subtitle: "Record books and practical manuals",
  },
  other: {
    imageUrl: createOtherPrintArt(),
    icon: "+",
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
