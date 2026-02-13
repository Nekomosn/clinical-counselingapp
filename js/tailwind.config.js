// js/tailwind.config.js
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#13daec",
                "primary-dark": "#0ea6b4",
                "primary-glow": "rgba(19, 218, 236, 0.15)",
                "background-light": "#f4f7f8",
                "background-dark": "#0a1416",
                "surface-light": "#ffffff",
                "surface-dark": "#15282a",
                "surface-dark-alt": "#0c181a",
                "slate-calm": "#eff4f5",
                "text-primary": "#1e293b",
                "text-secondary": "#64748b",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "2xl": "1rem",
                "3xl": "1.25rem",
                "full": "9999px"
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(19, 218, 236, 0.08)',
                'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                'card-lg': '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                'glow': '0 0 20px rgba(19, 218, 236, 0.12)',
                'inner-glow': 'inset 0 1px 2px rgba(19, 218, 236, 0.06)',
            },
            animation: {
                'spin-slow': 'spin 8s linear infinite',
            }
        },
    },
}