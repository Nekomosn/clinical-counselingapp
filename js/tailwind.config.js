// js/tailwind.config.js
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#13daec",
                "primary-dark": "#0ea6b4",

                // Light mode
                "background-light": "#f6f8f8",
                "slate-calm": "#eff4f5",

                // Dark mode (Indigo/Slate family)
                "bg-deep": "#0b1219",
                "bg-surface": "#141e29",
                "bg-panel": "#1b2a38",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(19, 218, 236, 0.05)',
                'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                'card-dk': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
            },
            animation: {
                'spin-slow': 'spin 8s linear infinite',
            }
        },
    },
}