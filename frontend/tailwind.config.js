/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                fontFamily: {
                        'display': ['Bebas Neue', 'sans-serif'],
                        'serif': ['Playfair Display', 'serif'],
                        'sans': ['Inter', 'sans-serif'],
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        neon: {
                                cyan: 'hsl(var(--neon-cyan))',
                                pink: 'hsl(var(--neon-pink))',
                                gold: 'hsl(var(--neon-gold))',
                                red: 'hsl(var(--neon-red))'
                        },
                        chrome: {
                                DEFAULT: 'hsl(var(--chrome))',
                                dark: 'hsl(var(--chrome-dark))'
                        }
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        },
                        'slot-spin': {
                                '0%': { transform: 'translateY(0)' },
                                '100%': { transform: 'translateY(-100%)' }
                        },
                        'pulse-glow': {
                                '0%, 100%': { opacity: '1', boxShadow: '0 0 20px hsl(43 100% 50% / 0.5)' },
                                '50%': { opacity: '0.8', boxShadow: '0 0 40px hsl(43 100% 50% / 0.8)' }
                        },
                        'lever-pull': {
                                '0%': { transform: 'rotate(0deg)' },
                                '50%': { transform: 'rotate(45deg)' },
                                '100%': { transform: 'rotate(0deg)' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'slot-spin': 'slot-spin 0.1s linear infinite',
                        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                        'lever-pull': 'lever-pull 0.5s ease-in-out'
                },
                boxShadow: {
                        'neon-gold': '0 0 20px hsl(43 100% 50% / 0.5), 0 0 40px hsl(43 100% 50% / 0.3)',
                        'neon-pink': '0 0 20px hsl(330 100% 60% / 0.5), 0 0 40px hsl(330 100% 60% / 0.3)',
                        'neon-cyan': '0 0 15px hsl(180 100% 50% / 0.4)',
                        'machine': '0 30px 60px hsl(0 0% 0% / 0.7), 0 10px 20px hsl(0 0% 0% / 0.5)',
                        'inner-slot': 'inset 0 10px 30px hsl(0 0% 0% / 0.8)'
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
