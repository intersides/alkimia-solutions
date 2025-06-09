module.exports = {
    apps: [{
        name: "proxy",
        script: "./proxy.js",
        watch: true,//process.env.ENV === "development",
        watch_delay: 1000,      // Delay between file change detection (ms)
        ignore_watch: [
            "node_modules",
            "Dockerfile",
            "package.json",
            "package-lock.json",
            ".git",
            ".idea/",
            ".idea/httpRequests",
            ".idea/workspace.xml",
            ".gitignore",
            "services",
            "event-matrix.json",
            "*.md"
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
