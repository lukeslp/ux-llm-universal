// ============================================================
// Theme Definitions — Three selectable UX concepts
// Hearthstone (warm dark), Zurich (Swiss brutalist), Nebula (cyberpunk)
// ============================================================

export type ThemeName = 'hearthstone' | 'zurich' | 'nebula';

export interface ThemeConfig {
  id: ThemeName;
  name: string;
  label: string;
  description: string;
  alwaysDark: boolean;
  borderRadius: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  swatchColors: [string, string, string]; // for preview cards
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  hearthstone: {
    id: 'hearthstone',
    name: 'Hearthstone',
    label: 'Warm',
    description: 'Warm, intimate, literary',
    alwaysDark: true,
    borderRadius: '0.75rem',
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Open Sans', system-ui, sans-serif",
    fontMono: "'Fira Code', 'JetBrains Mono', monospace",
    swatchColors: ['#1a0f0a', '#d4956a', '#8b6ce0'],
  },
  zurich: {
    id: 'zurich',
    name: 'Zurich',
    label: 'Sharp',
    description: 'Sharp, authoritative, clean',
    alwaysDark: false,
    borderRadius: '0px',
    fontDisplay: "Inter, 'Helvetica Neue', system-ui, sans-serif",
    fontBody: "Inter, 'Helvetica Neue', system-ui, sans-serif",
    fontMono: "'DM Mono', 'JetBrains Mono', monospace",
    swatchColors: ['#fafafa', '#0a0a0a', '#e60000'],
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    label: 'Neon',
    description: 'Technical, futuristic, immersive',
    alwaysDark: true,
    borderRadius: '0.75rem',
    fontDisplay: "Inter, system-ui, sans-serif",
    fontBody: "Inter, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    swatchColors: ['#0f172a', '#818cf8', '#22d3ee'],
  },
};

export const DEFAULT_THEME: ThemeName = 'hearthstone';
