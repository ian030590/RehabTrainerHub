import { en } from './en.js';
import { zh } from './zh.js';

export const dictionary = { en, zh };
export type CopyKey = keyof typeof en;
