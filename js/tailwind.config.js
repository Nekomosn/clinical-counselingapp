// js/tailwind.config.js
// カラー定義は css/style.css の先頭にあります。
// ここでは CSS変数 を参照しているだけです。

tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                // ブランドカラー（RGB変数 → 透過対応）
                "primary": "rgb(var(--c-primary) / <alpha-value>)",
                "primary-dark": "rgb(var(--c-primary-dark) / <alpha-value>)",

                // ライトモード背景
                "background-light": "var(--c-bg-main)",
                "slate-calm": "var(--c-bg-panel)",  // 右パネル背景

                // ダークモード背景（dark: プレフィックスで使用）
                "bg-deep": "var(--c-bg-main)",
                "bg-surface": "var(--c-bg-surface)",
                "bg-panel": "var(--c-bg-panel)",
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
                'soft': 'var(--c-shadow-soft)',
                'card': 'var(--c-shadow-card)',
                'card-dk': 'var(--c-shadow-card)',  // 同じ変数（dark時に自動切替）
            },
        },
    },
}