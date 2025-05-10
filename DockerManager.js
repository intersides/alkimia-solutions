import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import path from "node:path";
import Console from "@intersides/console";
import fs from "node:fs";

// Get the current file's directory name

export default function DockerManager(_args = null) {
    const instance = Object.create(DockerManager.prototype);
    const {root, envVars} = Utilities.transfer(_args, {
        root:null,
        envVars: null
    });
    const emitter = new EventEmitter();

    function _init() {
        return instance;
    }

    /**
     * Get container status: "running", "stopped", "not_exists", or "error"
     * @param {string} containerName - Name of the container
     * @returns {string} - Container status
     */
    function getContainerStatus(containerName) {
        try {
            // Check if the container exists
            const existsCommand = `docker ps -a -q -f name=^/${containerName}$ | wc -l`;
            const existsResult = execSync(existsCommand, {encoding: "utf8"});

            if (parseInt(existsResult.trim()) === 0) {
                return "not_exists";
            }

            // If it exists, check if it's running
            const runningCommand = `docker inspect -f '{{.State.Running}}' ${containerName}`;
            const runningResult = execSync(runningCommand, {encoding: "utf8"});

            return runningResult.trim().toLowerCase() === "true" ? "running" : "stopped";
        } catch (error) {
            Console.error(`Error checking container status for ${containerName}:`, error);
            return "error";
        }
    }

    /**
     * Check if Docker image exists
     * @param {string} imageName - Name of the image
     * @returns {boolean} - True if image exists
     */
    function doesImageExist(imageName) {
        const command = `docker image inspect ${imageName} >/dev/null 2>&1 && echo "exists" || echo "not exists"`;
        const exists = execSync(command, {encoding: "utf8"});
        return exists.trim() === "exists";
    }

    /**
     * Check if Docker network exists
     * @param {string} networkName - Name of the network
     * @returns {boolean} - True if network exists
     */
    function doesNetworkExist(networkName) {
        try {
            const result = execSync(`docker network ls --filter name=^${networkName}$ --format '{{.Name}}'`, {encoding: "utf8"});
            return result.trim() === networkName;
        } catch (error) {
            Console.error("Error checking network:", error);
            return false;
        }
    }

    /**
     * Create Docker network if it doesn't exist
     * @param {string} networkName - Name of the network to create
     * @returns {boolean} - True if network was created, false if it already existed
     */
    function ensureNetworkExists(networkName) {
        if (!doesNetworkExist(networkName)) {
            Console.log(`Creating Docker network: ${networkName}`);
            execSync(`docker network create ${networkName}`, {stdio: "inherit"});
            return true;
        }
        Console.log(`Docker network ${networkName} already exists`);
        return false;
    }

    /**
     * Stop and remove a container
     * @param {string} containerName - Name of the container
     */
    function stopAndRemoveContainer(containerName) {
        Console.log(`Stopping and removing container ${containerName}...`);
        execSync(`docker rm -f ${containerName} || true`, {stdio: "inherit"});
    }


    /**
     * Build base image for the workspace
     */
    function buildBaseImage() {
        Console.debug(`Building base image with context: ${root}`);

        // Use explicit absolute paths
        const dockerfilePath = path.resolve(root, "Dockerfile.base");

        const buildCommand = `docker build -f ${dockerfilePath} -t intersides-workspace-base ${root}`;

        Console.debug(`Executing: ${buildCommand}`);

        execSync(buildCommand, {
            cwd: root,
            stdio: "inherit"
        });

        return true;
    }

    /**
     * Run a command asynchronously
     * @param {string} command - Command to run
     * @returns {Promise<string>} - Command output
     */
    function runCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    Console.error(`Error: ${stderr}`);
                    reject(error);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }

    /**
     * Wait for container to be ready
     * @param {string} containerName - Container name
     * @param {number} [timeoutMs=3000] - Timeout in milliseconds
     * @returns {Promise<boolean>} - True if container is ready
     */
    function waitForContainerReady(containerName, timeoutMs = 3000) {
        Console.log(`Waiting for container ${containerName} to be ready...`);

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const status = getContainerStatus(containerName);
                Console.debug("DEBUG: status", status);

                emitter.emit(status, {
                    name: containerName,
                    env: envVars.ENV,
                    domain: envVars.DOMAIN
                });
                if (status === "running") {
                    Console.log(`Container ${containerName} is ready!`);
                    resolve(true);
                } else {
                    const error = new Error(`Container ${containerName} start timeout error (status: ${status})`);
                    Console.error(error.message);
                    reject(error);
                }
            }, timeoutMs);
        });
    }

    /**
     * Manage container lifecycle (create, start, or restart)
     * @param {Object} options - Container options
     * @returns {string} - Result of operation
     */
    function manageContainer(options) {
        const {
            name,
            container_name,
            subdomain,
            location,
            port,
            networkName = "alkimia-net",
            forceRestart = false
        } = options;

        Console.debug("DEBUG: location", location);
        Console.debug("DEBUG: root", root);


        // Ensure the network exists
        ensureNetworkExists(networkName);

        // Ensure base image exists
        if (!doesImageExist("intersides-workspace-base")) {
            buildBaseImage();
        }

        // Check container status
        const containerStatus = getContainerStatus(name);
        Console.debug(`Container ${name} status: ${containerStatus}`);

        // Handle based on status
        if (containerStatus === "running") {
            if (forceRestart) {
                stopAndRemoveContainer(name);
            } else {
                Console.info(`Container ${name} is already running`);
                return "already_running";
            }
        } else if (containerStatus === "stopped") {
            if (forceRestart) {
                stopAndRemoveContainer(name);
            } else {
                Console.info(`Starting existing container ${name}`);
                execSync(`docker start ${name}`, {stdio: "inherit"});
                return "started_existing";
            }
        }

        // Build the image - Use absolute paths and set the working directory to root
        const dockerfilePath = path.resolve(root, location, "Dockerfile");
        Console.debug(`Building image with Dockerfile at: ${dockerfilePath}`);
        Console.debug(`Build context: ${root}`);
        Console.debug(`Current working directory: ${process.cwd()}`);

        // Check if files exist
        const packageJsonPath = path.resolve(root, "package.json");
        Console.debug(`package.json exists: ${fs.existsSync(packageJsonPath)}`);

        const buildCommand = `docker build \
          -f ${dockerfilePath} \
          -t ${container_name} \
          --build-arg ENV=${envVars.ENV}\
          ${root}`;

        try {
            execSync(buildCommand, {
                cwd: root,
                stdio: "inherit"
            });
        } catch (error) {
            Console.error(`Build failed: ${error.message}`);
            throw error;
        }


        // Prepare volume mounts
        let volumeFlags = [
            "-v /app/node_modules"
        ];
        if (envVars.ENV === "development") {
            volumeFlags.push(`-v ${root}/${location}:/app`);
            volumeFlags.push(`-v ${root}/libs:/app/libs`);
        }
        volumeFlags = volumeFlags.join(" ");

        // Run the container
        const runCommand = `docker run -d \
          --name ${container_name} \
          --network ${networkName} \
          -p ${port}:${envVars.DOCKER_FILE_PORT} \
          -e ENV=${envVars.ENV} \
          -e PUBLIC_PORT=${port}\
          -e PORT=${envVars.DOCKER_FILE_PORT}\
          -e PROTOCOL=${envVars.PROTOCOL} \
          -e DOMAIN=${envVars.DOMAIN}\
          -e SUBDOMAIN=${subdomain} \
          ${volumeFlags} \
          ${container_name}`;

        Console.debug("About to execute command", runCommand);

        execSync(runCommand, {
            stdio: "inherit"
        });

        emitter.emit("container-started", {
            name: name,
            env: envVars.ENV,
            domain: envVars.DOMAIN,
            port: port
        });

        return "created_new";
    }

    /**
     * Start or restart MQTT broker container
     * @param {string} [_brokerName="mqtt-alkimia-broker"] - Name for the broker container
     * @returns {string} - Result of operation
     */
    function startMosquittoBroker(_brokerName = "mqtt-alkimia-broker") {
        const networkName = "alkimia-net";

        // Ensure the network exists
        ensureNetworkExists(networkName);

        // Check container status
        const containerStatus = getContainerStatus(_brokerName);
        Console.debug(`MQTT broker ${_brokerName} status: ${containerStatus}`);

        if (containerStatus === "running") {
            Console.info(`MQTT broker ${_brokerName} is already running`);
            return "already_running";
        } else if (containerStatus === "stopped") {
            Console.info(`Starting existing MQTT broker ${_brokerName}`);
            execSync(`docker start ${_brokerName}`, {stdio: "inherit"});
            return "started_existing";
        }

        // Create a new container - Use absolute paths
        const configPath = path.resolve(root, "services/mqtt/config");

        const runCommand = `docker run -d --name ${_brokerName} \
                             --network ${networkName} \
                             -p 1883:1883 \
                             -p 9001:9001 \
                             -v ${configPath}:/mosquitto/config \
                             -v mqtt_data:/mosquitto/data \
                             -v mqtt_log:/mosquitto/log \
                             eclipse-mosquitto:latest`;

        Console.debug("about to exec runCommand for mqtt broker with",runCommand);

        execSync(runCommand, {
            cwd: root,
            stdio: "inherit"
        });


        return "created_new";
    }

    // Expose methods on the instance
    instance.getContainerStatus = getContainerStatus;
    instance.doesImageExist = doesImageExist;
    instance.doesNetworkExist = doesNetworkExist;
    instance.ensureNetworkExists = ensureNetworkExists;
    instance.buildBaseImage = buildBaseImage;
    instance.waitForContainerReady = waitForContainerReady;
    instance.manageContainer = manageContainer;
    instance.startMosquittoBroker = startMosquittoBroker;
    instance.stopAndRemoveContainer = stopAndRemoveContainer;

    // For backward compatibility
    instance.checkContainerRunning = async (containerName) => {
        return getContainerStatus(containerName) === "running";
    };

    // Event handling
    instance.on = (event, listener) => emitter.on(event, listener);
    instance.off = (event, listener) => emitter.off(event, listener);
    instance.once = (event, listener) => emitter.once(event, listener);

    return _init();
}

// Singleton pattern
let _instance = null;

DockerManager.getSingleton = function(_args = null) {
    if (!_instance) {
        _instance = DockerManager(_args);
    }
    return _instance;
};

DockerManager.getInstance = function(_args = null) {
    return DockerManager(_args);
};
