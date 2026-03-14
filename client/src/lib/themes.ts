// ============================================================
// Theme Definitions — Three selectable UX concepts
// Lumen (warm light), Slate (neutral dark), Nebula (cyberpunk)
// ============================================================

export type ThemeName = 'lumen' | 'slate' | 'nebula';

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
  lumen: {
    id: 'lumen',
    name: 'Lumen',
    label: 'Light',
    description: 'Warm, clean, readable',
    alwaysDark: false,
    borderRadius: '0.625rem',
    fontDisplay: "Inter, system-ui, sans-serif",
    fontBody: "Inter, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    swatchColors: ['#faf9f6', '#1a1a1a', '#d45d2c'],
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    label: 'Dark',
    description: 'Calm, neutral, focused',
    alwaysDark: true,
    borderRadius: '0.5rem',
    fontDisplay: "Inter, system-ui, sans-serif",
    fontBody: "Inter, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    swatchColors: ['#1c1f26', '#c1c7d0', '#3b9e8f'],
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    label: 'Neon',
    description: 'Technical, futuristic, vivid',
    alwaysDark: true,
    borderRadius: '0.75rem',
    fontDisplay: "Inter, system-ui, sans-serif",
    fontBody: "Inter, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
    swatchColors: ['#0f172a', '#818cf8', '#22d3ee'],
  },
};

export const DEFAULT_THEME: ThemeName = 'slate';
