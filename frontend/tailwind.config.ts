import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
	darkMode: ["class"],
	content: ["./src/**/*.{ts,tsx}"],
	prefix: "",
	plugins: [typography],
	theme: {
		extend: {
			colors: {
				border: 'var(--border)',
				input: 'var(--input)',
				ring: 'var(--ring)',
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)'
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)'
				},
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)'
				},
			},
			fontFamily: {
				sans: ['IBM Plex Sans', 'var(--font-sans)', 'system-ui', 'sans-serif'],
				heading: ['IBM Plex Sans', 'var(--font-heading)', 'var(--font-sans)', 'sans-serif'],
				mono: ['var(--font-mono)', 'SFMono-Regular', 'monospace'],
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
		}
	},
} satisfies Config;
