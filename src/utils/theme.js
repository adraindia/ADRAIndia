// ADRA Official Brand Colors — Graphic Standards Manual (PMS 335C primary)
export const C = {
  green:       "#007B5F",
  greenDark:   "#005A45",
  greenLight:  "#E6F2EE",
  greenMid:    "#B3D9CE",
  greenGlow:   "rgba(0,123,95,0.12)",
  grey:        "#54585A",
  greyLight:   "#F4F6F5",
  greyBorder:  "#E2E6E4",
  white:       "#FFFFFF",
  black:       "#111918",
  surface:     "#FAFBFA",
  errorBg:     "#FEF2F2",
  errorText:   "#B91C1C",
};

export const F = {
  head: "'Montserrat', sans-serif",
  body: "'Zilla Slab', serif",
};

// Radius scale
export const R = {
  sm:  "8px",
  md:  "12px",
  lg:  "16px",
  xl:  "20px",
  pill:"999px",
};

// Shadow scale
export const S = {
  xs:  "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  sm:  "0 2px 8px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)",
  md:  "0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
  lg:  "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
  green: "0 4px 20px rgba(0,123,95,0.18)",
};

export const shared = {
  inputBase: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: `1.5px solid ${C.greyBorder}`,
    borderRadius: R.sm,
    fontFamily: F.body,
    fontSize: 15,
    color: C.black,
    outline: "none",
    background: C.white,
    lineHeight: 1.55,
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  card: {
    background: C.white,
    border: `1px solid ${C.greyBorder}`,
    borderRadius: R.lg,
    padding: "22px 20px",
    marginBottom: 16,
    boxShadow: S.sm,
  },
  btnGreen: {
    background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDark} 100%)`,
    color: "#fff",
    border: "none",
    borderRadius: R.pill,
    padding: "12px 26px",
    fontFamily: F.head,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    letterSpacing: "0.02em",
    boxShadow: S.green,
    transition: "opacity 0.15s, transform 0.1s",
  },
  btnOutline: {
    background: "transparent",
    color: C.green,
    border: `1.5px solid ${C.green}`,
    borderRadius: R.pill,
    padding: "10px 20px",
    fontFamily: F.head,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  btnRed: {
    background: "transparent",
    color: "#b91c1c",
    border: "1.5px solid #fca5a5",
    borderRadius: R.pill,
    padding: "7px 14px",
    fontFamily: F.head,
    fontSize: 11,
    cursor: "pointer",
  },
  fieldLabel: {
    display: "block",
    fontFamily: F.head,
    fontSize: 11,
    fontWeight: 700,
    color: C.grey,
    marginBottom: 6,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  tag: (type) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: R.pill,
    fontSize: 10,
    fontFamily: F.head,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: type === "case_story" ? C.greenLight : type === "newsletter" ? "#EAF0FB" : "#FEF3E2",
    color:      type === "case_story" ? C.green      : type === "newsletter" ? "#2563EB" : "#B45309",
  }),
};
