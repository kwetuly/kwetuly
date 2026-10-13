import { Atkinson_Hyperlegible, Fraunces } from 'next/font/google';

// Interface type and display type for the marketplace screens (see packages/shared/src/design.ts).
export const uiFont = Atkinson_Hyperlegible({ weight: ['400', '700'], subsets: ['latin', 'latin-ext'], variable: '--font-ui' });
export const displayFont = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-display' });

export const UI = 'var(--font-ui), sans-serif';
export const DISPLAY = 'var(--font-display), serif';
