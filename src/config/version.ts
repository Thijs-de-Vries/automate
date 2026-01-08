/**
 * App version - automatically injected at build time
 * 
 * Uses Git commit SHA (7 chars) from Vercel environment variables.
 * Falls back to 'dev' in development mode.
 */

declare const __APP_VERSION__: string;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
