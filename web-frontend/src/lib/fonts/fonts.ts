import { Inter, Noto_Sans_Bengali, Noto_Sans_Devanagari, Noto_Sans_Gujarati, Noto_Sans_Gurmukhi, Noto_Sans_Kannada, Noto_Sans_Malayalam, Noto_Sans_Oriya, Noto_Sans_Tamil, Noto_Sans_Telugu } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({ subsets: ['devanagari'], variable: '--font-noto-devanagari', display: 'swap', preload: false });
const bengali = Noto_Sans_Bengali({ subsets: ['bengali'], variable: '--font-noto-bengali', display: 'swap', preload: false });
const gujarati = Noto_Sans_Gujarati({ subsets: ['gujarati'], variable: '--font-noto-gujarati', display: 'swap', preload: false });
const gurmukhi = Noto_Sans_Gurmukhi({ subsets: ['gurmukhi'], variable: '--font-noto-gurmukhi', display: 'swap', preload: false });
const kannada = Noto_Sans_Kannada({ subsets: ['kannada'], variable: '--font-noto-kannada', display: 'swap', preload: false });
const malayalam = Noto_Sans_Malayalam({ subsets: ['malayalam'], variable: '--font-noto-malayalam', display: 'swap', preload: false });
const oriya = Noto_Sans_Oriya({ subsets: ['oriya'], variable: '--font-noto-oriya', display: 'swap', preload: false });
const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], variable: '--font-noto-tamil', display: 'swap', preload: false });
const telugu = Noto_Sans_Telugu({ subsets: ['telugu'], variable: '--font-noto-telugu', display: 'swap', preload: false });

export const fontVariables = [inter, devanagari, bengali, gujarati, gurmukhi, kannada, malayalam, oriya, tamil, telugu].map((font) => font.variable).join(' ');
