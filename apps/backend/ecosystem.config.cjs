module.exports = {
    apps: [{
        name: "backend",
        script: "./main.js",
        instances: "1",
        exec_mode: "cluster",
        watch:  process.env.ENV === "development" || process.env.NODE_ENV === "development",
        watch_delay: 1000,
        ignore_watch: [
            "node_modules",
            "tmp.json"
        ],
        watch_options: {
            "followSymlinks": false
        },
        env_development: {
            "NODE_ENV": "development",
            "ENV": "development"
        },
        env_production: {
            "NODE_ENV": "production",
            "ENV": "production"
        },
        max_memory_restart: "500M",
        restart_delay: 3000,
        exp_backoff_restart_delay: 100
    }]
};
