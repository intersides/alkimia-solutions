// frontend-runner.js
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

// Define frontend container options
const frontendOptions = {
    name: "alkimia-frontend",
    service: "frontend",
    location: "apps/frontend",
    port: 7070,
    forceRestart: process.argv.includes("--force")
};

// Main function to build and run the frontend
async function runFrontend() {
    try {
        Console.info("Starting frontend container...");
    
        // Ensure network exists
        dockerManager.ensureNetworkExists("alkimia-net");
    
        // Check if container is already running
        const isRunning = await dockerManager.checkContainerRunning(frontendOptions.name);
    
        if (isRunning && !frontendOptions.forceRestart) {
            Console.info(`Frontend container ${frontendOptions.name} is already running`);
            return;
        }
    
        // Build and run the container
        const result = dockerManager.manageContainer(frontendOptions);
    
        Console.info(`Container operation result: ${result}`);
    
        if (result === "created_new") {
            // Wait for container to be ready
            await dockerManager.waitForContainerReady(frontendOptions.name);
            Console.info("Frontend is now available at https://app.alkimia.localhost");
        }
    } catch (error) {
        Console.error("Failed to start frontend container:", error);
    }
}

// Run the frontend
runFrontend();
