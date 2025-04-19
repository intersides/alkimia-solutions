import { defineConfig } from "vite";

export default defineConfig({
    server: {
        host: "0.0.0.0",  // Allows external access (Docker)
        port: 3000,
        strictPort: true,
        watch: {
            usePolling: true, // Enables hot-reloading in Docker
        },
    },
    hmr: {
        clientPort: 443,
        host: 'app.alkimia.localhost',
        protocol: 'wss'
    },
    css: {
        preprocessorOptions: {
            scss: {
                // If you have any global imports or variables
                // additionalData: `@import "./src/styles/variables.scss";`
            }
        }
    }


});
