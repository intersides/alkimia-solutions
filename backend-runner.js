// backend-runner.js
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import DockerManager from "./modules/DockerManager.js";
import { parseEnvFile } from "@workspace/common";
import Console from "@intersides/console";

// Get project root path
const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
let envContent = fs.readFileSync(`${_projectRootPath}/.env`, { encoding: "utf-8" });
let envVars = parseEnvFile(envContent);

// Initialize DockerManager
const dockerManager = DockerManager.getInstance({
    root: _projectRootPath,
    envVars
});


// Set up event listeners
dockerManager.on("container-started", function(params) {
    Console.info(`Container ${params.name} has started`);
});

dockerManager.on("running", function(params) {
    Console.info(`Container ${params.name} is running`);
});

// Define backend container options
const backendOptions = {
    name: "alkimia-backend",
    service: "backend",
    location: "apps/backend",
    port: 8080,
    forceRestart: process.argv.includes("--force")
};

// Main function to build and run the backend
async function runBackend() {
    try {
        Console.info("Starting backend container...");
    
        // Ensure network exists
        dockerManager.ensureNetworkExists("alkimia-net");
    
        // Check if container is already running
        const isRunning = await dockerManager.checkContainerRunning(backendOptions.name);
    
        if (isRunning && !backendOptions.forceRestart) {
            Console.info(`Backend container ${backendOptions.name} is already running`);
            return;
        }
    
        // Build and run the container
        const result = dockerManager.manageContainer(backendOptions);
    
        Console.info(`Container operation result: ${result}`);
    
        if (result === "created_new") {
            // Wait for container to be ready
            await dockerManager.waitForContainerReady(backendOptions.name);
            Console.info("Backend is now available at https://server.alkimia.localhost");
        }
    } catch (error) {
        Console.error("Failed to start backend container:", error);
    }
}

// Run the backend
runBackend();
