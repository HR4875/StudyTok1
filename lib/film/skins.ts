// A skin is a design that the same scene script can wear: colours, corner shape, background and sound.
// Scripts name colours by role ("blue" is the skin's main colour, "yellow" its highlighter), so one script plays in every skin.

export interface Skin {
  id: string; name: string; dark: boolean;
  bg: string; card: string; ink: string; sub: string; grey: string; line: string;
  primary: string; soft: string; accent: string; good: string; bad: string; white: string;
  font: string; radius: number; stroke: number; deco: "none" | "dots" | "grid" | "glow";
  audio: { bpm: number; root: number; mode: "major" | "minor" | "dorian" | "lydian"; lead: string; drums: "full" | "soft" | "none" };
}

const FONT = "'Wanted Sans Variable', 'Wanted Sans', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

// No inherited keys: a skin id comes from saved settings or from a script, and "constructor" must not find a member of Object.
export const SKINS: Record<string, Skin> = Object.assign(Object.create(null) as Record<string, Skin>, {
  // Design F: warm paper, near-black ink, one blue, a yellow marker
  paper: {
    id: "paper", name: "페이퍼", dark: false, bg: "#F4F3EF", card: "#FFFFFF", ink: "#232325", sub: "#55555B", grey: "#B9B8B2", line: "#DEDCD5",
    primary: "#0A5FC2", soft: "#C9E2FF", accent: "#FFD43B", good: "#1286F0", bad: "#F2241B", white: "#FFFFFF", // only the seven colours of Design F: "good" is its bright blue, "bad" its red
    font: FONT, radius: 28, stroke: 8, deco: "none", audio: { bpm: 100, root: 62, mode: "major", lead: "mallet", drums: "soft" },
  },
  // Design B: ink and paper, one colour (green, meaning "what counts"); no marker yellow, no red, cool light paper
  ink: {
    id: "ink", name: "잉크", dark: false, bg: "#EEF0F3", card: "#FFFFFF", ink: "#111318", sub: "#4A4F5A", grey: "#B8BDC6", line: "#DADDE3",
    primary: "#1DB86F", soft: "#D3F3E2", accent: "#BDEFD4", good: "#1DB86F", bad: "#111318", white: "#FFFFFF",
    font: FONT, radius: 14, stroke: 7, deco: "none", audio: { bpm: 120, root: 62, mode: "major", lead: "sine", drums: "soft" },
  },
  // Design D: white paper with a dot grid
  note: {
    id: "note", name: "노트", dark: false, bg: "#FFFFFF", card: "#F5F7FA", ink: "#16171A", sub: "#5A5F69", grey: "#C3C7CF", line: "#E4E7EC",
    primary: "#3D5AFE", soft: "#DDE3FF", accent: "#FFE14D", good: "#12A46B", bad: "#F0443F", white: "#FFFFFF",
    font: FONT, radius: 18, stroke: 7, deco: "dots", audio: { bpm: 104, root: 60, mode: "lydian", lead: "bell", drums: "soft" },
  },
  // Design C: a dark stage with lit objects
  night: {
    id: "night", name: "나이트", dark: true, bg: "#0F1117", card: "#1B1F2A", ink: "#F3F4F6", sub: "#A7ADBA", grey: "#596072", line: "#2B303D",
    primary: "#5EA2FF", soft: "#1D3156", accent: "#FFD43B", good: "#3DD68C", bad: "#FF6B6B", white: "#FFFFFF",
    font: FONT, radius: 30, stroke: 8, deco: "glow", audio: { bpm: 96, root: 57, mode: "dorian", lead: "pluck", drums: "soft" },
  },
  // Design R: a blueprint drawn with a white pen
  blueprint: {
    id: "blueprint", name: "블루프린트", dark: true, bg: "#123F92", card: "#1A4DA8", ink: "#F5F9FF", sub: "#B9D0F5", grey: "#6F93D6", line: "#2A5BB8",
    primary: "#9FD3FF", soft: "#1F58BE", accent: "#FFD43B", good: "#7CF0B5", bad: "#FF8E8E", white: "#FFFFFF",
    font: FONT, radius: 10, stroke: 7, deco: "grid", audio: { bpm: 98, root: 64, mode: "lydian", lead: "sine", drums: "none" },
  },
  // Design A: speech bubbles and cards, bright and loud
  pop: {
    id: "pop", name: "팝", dark: false, bg: "#FFF6EC", card: "#FFFFFF", ink: "#1E1B22", sub: "#5B5560", grey: "#C9C0C4", line: "#EADFD6",
    primary: "#E3256B", soft: "#FFD3E2", accent: "#FFD43B", good: "#0FA36B", bad: "#E5484D", white: "#FFFFFF",
    font: FONT, radius: 40, stroke: 9, deco: "none", audio: { bpm: 112, root: 65, mode: "major", lead: "pluck", drums: "full" },
  },
});

export const skinOf = (id?: string): Skin => SKINS[String(id || "paper")] || SKINS.paper;
export const SKIN_LIST = Object.values(SKINS).map((s) => ({ id: s.id, name: s.name }));
