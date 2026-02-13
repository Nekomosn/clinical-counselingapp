// js/tailwind.config.js
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#13daec",
                "primary-dark": "#0ea6b4",
                "background-light": "#f6f8f8",
                "background-dark": "#102022",
                "slate-calm": "#eff4f5",
                "text-primary": "#1e293b",
                "text-secondary": "#64748b",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(19, 218, 236, 0.05)',
                'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            }
        },
    },
}