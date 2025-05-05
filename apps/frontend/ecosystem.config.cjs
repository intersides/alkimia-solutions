module.exports = {
    apps: [{
        name: "frontend",
        script: "./server.js",  // Your frontend server script
        watch: true,            // Enable file watching
        watch_delay: 1000,      // Delay between file change detection (ms)
        ignore_watch: [         // Files and patterns to ignore
            "node_modules",
            "Dockerfile",
            "package.json",
            "package-lock.json",
            ".git",
            ".gitignore",
            "*.md",
            "dist"
        ],
        watch_options: {
            "followSymlinks": false,
            "usePolling": true,   // Better for Docker environments
            "alwaysStat": false,
            "useFsEvents": true
        },
        env_development: {
            "NODE_ENV": "development"
        },
        env_production: {
            "NODE_ENV": "production"
        }
    }]
};
