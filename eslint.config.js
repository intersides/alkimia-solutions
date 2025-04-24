export default [
    {
        ignores: ["node_modules/**"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                fetch: "readonly",
                WebSocket: "readonly",
                // Node.js globals
                process: "readonly",
                __dirname: "readonly",
                globalThis: "readonly"
            }
        },
        rules: {
            "indent": ["error", 4],
            "linebreak-style": ["error", "unix"],
            "quotes": ["error", "double"],
            "semi": ["error", "always"],
            "no-unused-vars": ["warn"],
            "comma-dangle": ["error", "never"]
        }
    },
    {
        files: ["apps/frontend/**/*.js"],
        languageOptions: {
            globals: {
                window: "readonly",
                document: "readonly"
            }
        }
    },
    {
        files: ["apps/backend/**/*.js"],
        languageOptions: {
            globals: {
                process: "readonly",
                __dirname: "readonly"
            }
        }
    }
];
