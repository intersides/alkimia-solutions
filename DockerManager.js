import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import path from "node:path";
import Console from "@intersides/console";
import fs from "node:fs";

export default function DockerManager(_args = null) {
    const instance = Object.create(DockerManager.prototype);
    const {root, envVars, serviceDispatcher} = Utilities.transfer(_args, {
        root:null,
        envVars: null,
        serviceDispatcher:null
    });

    function _init() {
        listenToContainerEvents();
        return instance;
    }

    function listenToContainerEvents() {
        const eventCommand = "docker events --format '{{json .}}'";

        const child = exec(eventCommand);

        child.stdout.on("data", (data) => {
            try {
                const lines = data.trim().split("\n");
                for (const line of lines) {


                    let event = null;
                    try{
                        event = JSON.parse(line);
                    }
                    catch(e){
                        Console.error(e);
                        Console.error(`failed to parse docker data event {${e.message}} for entry:`, line );
                    }

                    if(event){
                        if (event.Type === "container" && [
                            "create",
                            "start",
                            "restart",
                            "pause",
                            "destroy",
                            "stop",
                            "die",
                            "kill",
                            "oom"
                        ].includes(event.Action)) {
                            const name = event.Actor?.Attributes?.name || event.Actor?.ID || "unknown";

                            const eventTime = new Date(event.timeNano / 1e6); // to milliseconds

                            Console.log(`[DockerService] Container ${name} ${event.Action}`);
                            DockerManager.emitter.emit("event", {
                                type:"docker-container",
                                timestamp: eventTime,
                                data:{
                                    name,
                                    action: event.Action
                                }
                            });

                            let serviceManifest = serviceDispatcher.getService(name);

                            let containerInfo = {
                                ...serviceManifest,
                                env: envVars.ENV,
                                state:event.Action,
                                id: event.ID,
                                timestamp: eventTime
                            };

                            switch(event.Action){
                                case "create":{
                                    DockerManager.emitter.emit("container-created", containerInfo);
                                }break;

                                case "restart":{
                                    DockerManager.emitter.emit("container-restarted", containerInfo);
                                }break;

                                case "start":{
                                    DockerManager.emitter.emit("container-started", containerInfo);
                                }break;

                                case "kill":{
                                    DockerManager.emitter.emit("container-killed", containerInfo);
                                }break;

                                case "stop":{
                                    DockerManager.emitter.emit("container-stopped", containerInfo);
                                }break;

                                case "destroy":{
                                    DockerManager.emitter.emit("container-destroyed", containerInfo);
                                }break;

                                case "die":{
                                    DockerManager.emitter.emit("container-died", containerInfo);
                                }break;

                                default:{
                                    Console.warn("not dealing with docker event :", event.Action);
                                }break;
                            }

                            // if(containerInfo.monitored){
                            //     containerMonitorService.monitorContainerCpu(containerInfo.name, 2000, 0, (state)=>{});
                            //
                            // }


                        }
                    }


                }
            } catch (e) {
                Console.warn("[DockerService] Failed to parse docker event:", e);
            }
        });

        child.stderr.on("data", (err) => {
            Console.error("[DockerService] Error from docker events:", err);
        });

        child.on("exit", (code) => {
            Console.error(`[DockerService] docker events process exited with code ${code}`);
        });
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

                DockerManager.emitter.emit(status, {
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
     * Checks if a Docker container is in a healthy state within a specified timeout period.
     *
     * @param {string} containerName - The name of the Docker container to check.
     * @param {number} timeoutMs - The maximum time in milliseconds to wait for the container to become healthy.
     * @return {Promise<boolean>} A promise that resolves to `true` if the container is healthy, or rejects with an error if the container is unhealthy, an error occurs, or the timeout is exceeded.
     */
    function waitUntilContainerIsHealthy(containerName, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const intervalMs = 2000; // Check every 2 seconds
            let elapsedTime = 0;

            const checkHealth = () => {
                exec(`docker inspect -f '{{.State.Health.Status}}' ${containerName}`, (err, stdout, stderr) => {
                    if (err) {
                        Console.error(`Error checking health for container ${containerName}:`, stderr);
                        reject(err); // Fail if there's an error
                        return;
                    }

                    const status = stdout.trim();
                    Console.debug(`Health check status for container "${containerName}":`, status);

                    if (status === "healthy") {
                        resolve(true); // Healthy, resolve success
                    } else if (status === "unhealthy") {
                        reject(new Error(`Container ${containerName} is unhealthy.`)); // Unhealthy, reject promise
                    } else {
                        if (elapsedTime >= timeoutMs) {
                            reject(new Error(`Container ${containerName} did not become healthy within ${timeoutMs}ms.`));
                        } else {
                            elapsedTime += intervalMs;
                            setTimeout(checkHealth, intervalMs); // Retry after interval
                        }
                    }
                });
            };

            checkHealth(); // Start checking
        });
    }

    /**
     * Manage container lifecycle (create, start, or restart)
     * @param {Object} manifest - manifest object
     * @param {Object} options - Container options
     * @returns {string} - Result of operation //NOTE the return result is not used
     */
    function manageContainer(manifest, options) {

        const {
            runningEnv="production",
            forceRestart=false
        } = options;

        //override ENV in manifest with the one from options
        manifest.config.env["ENV"] = runningEnv;

        // Ensure the network exists
        ensureNetworkExists(manifest.config.network);

        // Ensure base image exists
        if (!doesImageExist("intersides-workspace-base")) {
            buildBaseImage();
        }

        // Check container status
        const containerStatus = getContainerStatus(manifest.config.container_name);

        // Handle based on status
        if (containerStatus === "running") {
            if (forceRestart) {
                stopAndRemoveContainer(manifest.config.container_name);
            } else {
                Console.info(`Container ${manifest.config.container_name} is already running`);
                return "already_running";
            }
        } else if (containerStatus === "stopped") {
            if (forceRestart) {
                stopAndRemoveContainer(manifest.config.container_name);
            } else {
                Console.log(`Starting existing container ${manifest.config.container_name}`);
                execSync(`docker start ${manifest.config.container_name}`, {stdio: "inherit"});
                return "started_existing";
            }
        }

        // Build the image - Use absolute paths and set the working directory to root
        const dockerfilePath = path.resolve(root, manifest.config.location, "Dockerfile");
        Console.log(`Building image with Dockerfile at: ${dockerfilePath}`);
        Console.log(`Build context: ${root}`);
        Console.log(`Current working directory: ${process.cwd()}`);

        // Check if files exist TODO: WHY DO I NEED THIS?
        const packageJsonPath = path.resolve(root, "package.json");
        Console.debug(`package.json exists: ${fs.existsSync(packageJsonPath)}`);

        const buildCommand = `docker build \
          -f ${dockerfilePath} \
          -t ${manifest.config.container_name} \
          --build-arg ENV=${runningEnv}\
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
        if (runningEnv === "development") {
            volumeFlags.push(`-v ${root}/${manifest.config.location}:/app`);
            volumeFlags.push(`-v ${root}/libs:/app/libs`);
        }
        volumeFlags = volumeFlags.join(" ");

        const envVariablesPart = Object.entries(manifest.config.env)
            .map(([key, value]) => `-e ${key}=${value}`)
            .join(" ");

        // Run the container
        const runCommand = `docker run -d \
          --name ${manifest.config.container_name} \
          --network ${manifest.config.network} \
          --cpus=1 \
          --memory=512m \
          -p ${manifest.config.env.PUBLIC_PORT}:${manifest.config.env.PORT} \
          ${envVariablesPart} \
          ${volumeFlags} \
          ${manifest.config.container_name}`;

        Console.debug("About to execute command", runCommand);

        execSync(runCommand, {
            stdio: "inherit"
        });

        DockerManager.emitter.emit("container-started", {
            name: manifest.config.container_name,
            env: runningEnv,
            domain: manifest.config.public_domain,
            port: manifest.config.external_port
        });

        return "created_new";
    }

    /**
     * Start or restart MongoDB container with replica set support
     * @param {string} [_containerName="mongodb-alkimia-storage"] - Name for the MongoDB container
     * @param _networkName
     * @returns {string} - Result of operation
     */
    function startMongoDb(_containerName = "mongodb-alkimia-storage", _networkName = "alkimia-net") {
        // Ensure the network exists
        ensureNetworkExists(_networkName);

        // Check container status
        const containerStatus = getContainerStatus(_containerName);
        Console.debug(`MongoDB ${_containerName} status: ${containerStatus}`);

        if (containerStatus === "running") {
            Console.info(`MongoDB ${_containerName} is already running`);
            return "already_running";
        } else if (containerStatus === "stopped") {
            Console.info(`Starting existing MongoDB ${_containerName}`);
            execSync(`docker start ${_containerName}`, {stdio: "inherit"});
            return "started_existing";
        }

        // Create the data directory if it doesn't exist
        const dataPath = path.resolve(root, "services/mongodb/data");
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }

        // Create a MongoDB config directory if it doesn't exist
        const configPath = path.resolve(root, "services/mongodb/config");
        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(configPath, { recursive: true });
        }
        console.debug("DEBUG: configPath", configPath);

        // Create a keyFile for replica set authentication
        const keyFilePath = path.resolve(configPath, "mongodb-keyfile");
        if (!fs.existsSync(keyFilePath)) {
            // Generate a secure random key
            execSync(`openssl rand -base64 756 > ${keyFilePath}`, { stdio: "inherit" });
            // Set proper permissions (MongoDB requires file permissions to be 400)
            execSync(`chmod 400 ${keyFilePath}`, { stdio: "inherit" });
        }

        // Create a new container with replica set support
        const runCommand = `docker run -d --name ${_containerName} \
                         --network ${_networkName} \
                         -p 27017:27017 \
                         -p 28017:28017 \
                         -e MONGO_INITDB_ROOT_USERNAME=mongoadmin \
                         -e MONGO_INITDB_ROOT_PASSWORD=secret \
                         -v ${dataPath}:/data/db \
                         -v ${keyFilePath}:/data/mongodb-keyfile \
                         --health-cmd "mongosh --eval 'db.runCommand({ ping: 1 })' --quiet" \
                         --health-interval=10s \
                         --health-timeout=5s \
                         --health-retries=5 \
                         --health-start-period=30s \
                         mongo:latest \
                         --replSet rs0  \
                         --keyFile /data/mongodb-keyfile \
                         --bind_ip_all`;

        Console.debug("About to exec runCommand for MongoDB with", runCommand);

        execSync(runCommand, {
            cwd: root,
            stdio: "inherit"
        });

        // After starting the container, initialize the replica set when ready
        Console.info("Waiting for MongoDB to start before initializing replica set...");

        // Function to check if MongoDB is ready and initialize a replica set
        const initializeReplicaSetWhenReady = () => {
            try {
                // Check if MongoDB is responding to commands
                const checkCommand = `docker exec ${_containerName} mongosh -u mongoadmin -p secret --eval 'db.runCommand({ ping: 1 })' --quiet`;
                execSync(checkCommand, { stdio: "pipe" });

                // MongoDB is ready, initializing the replica set
                Console.info("MongoDB is ready, initializing replica set...");
                const initReplicaSet = `docker exec ${_containerName} mongosh -u mongoadmin -p secret --eval 'rs.initiate({_id: "rs0", members: [{_id: 0, host: "localhost:27017"}]})'`;
                execSync(initReplicaSet, { stdio: "inherit" });
                Console.info("MongoDB replica set initialized successfully");

                return true;
            } catch (error) {
                Console.debug("MongoDB not ready yet, retrying...");
                return false;
            }
        };

        // Set up polling with exponential backoff
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = 1000; // Start with 1 second

        const pollForMongoDB = () => {
            if (attempts >= maxAttempts) {
                Console.error(`Failed to initialize MongoDB replica set after ${maxAttempts} attempts`);
                return;
            }

            attempts++;
            if (initializeReplicaSetWhenReady()) {
                return; // Success
            } else {
                // Exponential backoff with a cap
                const nextInterval = Math.min(pollInterval * Math.pow(1.5, attempts - 1), 10000);
                Console.debug(`Retrying in ${nextInterval}ms (attempt ${attempts}/${maxAttempts})`);
                setTimeout(pollForMongoDB, nextInterval);
            }
        };

        // Start polling
        pollForMongoDB();

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
    instance.waitUntilContainerIsHealthy = waitUntilContainerIsHealthy;
    instance.manageContainer = manageContainer;
    instance.startMongoDb = startMongoDb;
    instance.startMosquittoBroker = startMosquittoBroker;
    instance.stopAndRemoveContainer = stopAndRemoveContainer;


    instance.checkContainerRunning = async (containerName) => {

        let status = getContainerStatus(containerName);

        DockerManager.emitter.emit(status, {
            name: containerName,
            env: envVars.ENV,
            domain: envVars.DOMAIN
        });

        return status === "running";


    };

    // Event handling

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

DockerManager.emitter = new EventEmitter();
DockerManager.on = (event, listener) => DockerManager.emitter.on(event, listener);
DockerManager.off = (event, listener) => DockerManager.emitter.off(event, listener);
DockerManager.once = (event, listener) => DockerManager.emitter.once(event, listener);

