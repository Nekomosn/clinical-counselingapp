// js/tailwind.config.js
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                // Brand
                "primary": "#13daec",
                "primary-dark": "#0ea6b4",
                "primary-glow": "rgba(19, 218, 236, 0.15)",

                // Surfaces (backgrounds)
                "bg-light": "#f4f7f8",
                "bg-dark": "#0a1416",
                "surface-light": "#ffffff",
                "surface-dark": "#132325",
                "surface-dark-2": "#0e1b1d",
                "panel-light": "#f0f4f5",
                "panel-dark": "#0b1517",

                // Text
                "txt": "#1e293b",
                "txt-dark": "#e2e8f0",
                "txt-sub": "#64748b",
                "txt-sub-dark": "#94a3b8",
                "txt-muted": "#94a3b8",
                "txt-muted-dark": "#64748b",

                // Borders
                "bdr": "#e2e8f0",
                "bdr-dark": "#1e3538",
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
                'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
                'card-lg': '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                'glow': '0 0 20px rgba(19, 218, 236, 0.12)',
                'inner-glow': 'inset 0 1px 2px rgba(19, 218, 236, 0.06)',
                'dark-card': '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15)',
            },
            animation: {
                'spin-slow': 'spin 8s linear infinite',
            }
        },
    },
}