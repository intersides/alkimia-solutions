import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import path from "node:path";
import Console from "@intersides/console";
import ServiceDispatcher from "./modules/ServiceDispatcher.js";
import { ObjectId } from "mongodb";
import fs from "node:fs";
import {DateTime} from "luxon";

/**
 * Creates a Docker manager instance for container lifecycle management
 * @example
 * const dockerManager = DockerManager({
 *   root: '/path/to/project',
 *   envVars: process.env,
 *   serviceDispatcher: serviceDispatcherInstance
 * });
 *
 * @param {Object} _args - Configuration options for the Docker manager
 * @param {string} _args.root - Root directory path for the project
 * @param {Object} _args.envVars - Environment variables for container configuration
 * @param {ServiceDispatcher} _args.serviceDispatcher - Service dispatcher instance for service management
 * @returns {Object} The DockerManager instance * @return {*}
 * @constructor
 */
export default function DockerManager(_args = null) {
    const instance = Object.create(DockerManager.prototype);
    const {root, envVars, manifest} = Utilities.transfer(_args, {
        root:null,
        envVars: null,
        manifest:null
    });

    const RESTART_LISTENER = 5000;

    function _init() {
        listenToContainerEvents();
        return instance;
    }

    DockerManager.on("docker-event_stream-exit", function(eventData){
        Console.warn("onEvent 'docker-event_stream-exit'", eventData);
        Console.info(`restarting container events listener in ${RESTART_LISTENER} ms`);
        setTimeout(()=>{
            listenToContainerEvents();
        }, RESTART_LISTENER);
    });

    function emitDockerEvent(serviceId){

        let container = getContainer(serviceId);
        if(container){
            let serviceGroup = container.Config.Labels["service.group"];
            let serviceManifest = manifest.services[serviceGroup];
            let serviceInstance = container.Config.Labels["service.instance"];
            let hostPort = container.NetworkSettings.Ports[`${serviceManifest.config.internal_port}/tcp`][0]["HostPort"];

            DockerManager.emitter.emit("docker-update-event", {
                state:container.State.Status,
                instance_id:container.Id,
                instance_name:serviceId,
                env: process.env.ENV,
                serviceGroup,
                serviceInstance,
                hostPort,
                timestamp:  new Date(container.Created),
                data:serviceManifest,
                updatedAt:new Date()

            });
        }
        else{
            Console.warn(`Cannot determine running container with service id: ${serviceId}`);
        }


    }

    function listenToContainerEvents() {
        const eventCommand = "docker events --format '{{json .}}'";

        const eventStream = exec(eventCommand);

        eventStream.stdout.on("data", function(data){
            try {
                if( Utilities.isNonemptyString(data.trim())){
                    const lines = data.trim().split("\n");
                    for (const line of lines) {

                        let event = null;
                        try{
                            event = JSON.parse(line);
                        }
                        catch(e){
                            Console.error(e);
                            Console.error(`failed to parse docker data event {${e.message}} for entry:`, line, "for data", data);
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
                                "oom", //out of memory
                                "exec_start"
                            ].some(actionType => event["Action"].startsWith(actionType))) {

                                const rawAction = event["Action"];
                                const actionType = rawAction.split(":")[0];

                                if(actionType === "exec_start" && !rawAction.includes("Docker-Health-Check")){
                                    Console.warn("Skipping exec_start not related to Docker-Health-Check", rawAction);
                                    return;
                                }


                                const containerName = event.Actor?.Attributes?.name || event.Actor?.ID || "unknown";
                                const containerId = event.Actor?.ID || null;
                                const serviceGroup = event.Actor?.Attributes?.["service.group"] || null;

                                const eventTime = new Date(event.timeNano / 1e6); // to milliseconds

                                Console.log(`[DockerService] Container ${containerName} ${event.Action}` );

                                DockerManager.emitter.emit("event", {
                                    type:"docker-container",
                                    timestamp: eventTime,
                                    state: actionType,
                                    data:{
                                        container_name:containerName,
                                        container_id:containerId,
                                        action: actionType,
                                        manifest:manifest.services[serviceGroup]
                                    }
                                });

                                emitDockerEvent(containerName);

                            }
                            else{
                                Console.log(`Not trapped docker event.Action:${event["Action"]}`);
                            }
                        }


                    }
                }
                else{
                    Console.warn("container event  has no data", arguments);
                }
            } catch (e) {
                Console.warn("[DockerService] Failed to parse docker event:", e);
            }
        });

        eventStream.stderr.on("data", (err) => {
            Console.error("[DockerService] Error from docker events:", err);
        });

        eventStream.on("exit", (code) => {
            Console.error(`[DockerService] docker events process exited with code ${code}`);
            // listenToContainerEvents();
            DockerManager.emitter.emit("docker-event_stream-exit", {
                errorCode:code,
                eventAt:new Date()
            });
        });
    }

    function getContainerById(containerId) {
        try {
            // Check if the container exists
            const existsCommand = `docker ps -a -q -f id=${containerId} | wc -l`;
            const existsResult = execSync(existsCommand, {encoding: "utf8"});
            if (parseInt(existsResult.trim()) === 0) {
                return null;
            }

            // If it exists, check if it's running
            const runningCommand = `docker inspect --format '{{json .}}' ${containerId}`;
            const runningResult = execSync(runningCommand, {encoding: "utf8"});
            Console.debug("runningResult:", runningResult);
            return JSON.parse(runningResult.trim()) ;
        } catch (error) {
            Console.error(`Error checking container status for ${containerName}:`, error);
            return null;
        }
    }

    function getContainer(id, property="name") {
        try {
            // Check if the container exists
            const existsCommand = `docker ps -a -q -f ${property}=^/${id}$ | wc -l`;
            const existsResult = execSync(existsCommand, {encoding: "utf8"});
            if (parseInt(existsResult.trim()) === 0) {
                Console.warn(`Container ${id} NOT FOUND!`);
                return null;
            }

            // If it exists, check if it's running
            const runningCommand = `docker inspect --format '{{json .}}' ${id}`;
            const runningResult = execSync(runningCommand, {encoding: "utf8"});
            return JSON.parse(runningResult.trim()) ;
        } catch (error) {
            Console.error(`Error checking container status for ${id}:`, error);
            return null;
        }
    }

    function getAllManifestContainers(){
        let containers = Object.keys(manifest.services).map(serviceId=>{
            return getContainersByFilter(serviceId);
        });
        return containers;

    }

    /**
     *
     * @param {string} filterValue
     * @param {string} filterType
     * @param {string | null} state - "running" "created" "restarting" "running" "removing" "paused" "exited" "dead"
     * @return {any[]|*[]|null}
     */
    function getContainersByFilter(filterValue, filterType="image", state=null) {
        try {
            let filterCmd = [];

            // Add filter by image or group
            if(filterType === "image"){
                filterCmd.push(`--filter ancestor=${filterValue}`);
            }
            else if(filterType === "group"){
                filterCmd.push(`--filter "label=service.group=${filterValue}"`);
            }
            else if(filterType === "namespace"){
                filterCmd.push(`--filter "label=service.namespace=${filterValue}"`);
            }

            // Add state filter if provided
            if(state) {
                filterCmd.push(`--filter status=${state}`);
            }

            // Join all filters
            const filterString = filterCmd.join(" ");

            const command = `docker ps -a  --no-trunc --format '{{json .}}' ${filterString}`;
            const result = execSync(command, { encoding: "utf8" });
            if(!result){
                return null;
            }

            return result
                .trim()
                .split("\n")
                .filter(line => line.trim() !== "") // Handle empty lines
                .map(line => JSON.parse(line));

        } catch (error) {
            Console.error(error);
            Console.error("Error retrieving container instances:", error.message);
            return [];
        }
    }

    async function checkContainerRunning(containerName){
        let container = getContainer(containerName);
        if(container){
            return container?.State?.Status === "running";
        }
        else{
            return false;
        }
    }


    /**
     * Get container status: "running", "stopped", "not_exists", or "error"
     * @param {string} identifier - Name of the container
     * @param {string} identifierType - name or id
     * @returns {string} - Container status
     */
    function getContainerStatus(identifier, identifierType="name") {
        try {
            // Check if the container exists
            const existsCommand = `docker ps -a -q -f ${identifierType}=^/${identifier}$ | wc -l`;
            const existsResult = execSync(existsCommand, {encoding: "utf8"});
            Console.debug("existsCommand", existsCommand, existsResult);
            if (parseInt(existsResult.trim()) === 0) {
                return "not_exists";
            }

            // If it exists, check if it's running
            const runningCommand = `docker inspect -f '{{.State.Running}}' ${identifier}`;
            const runningResult = execSync(runningCommand, {encoding: "utf8"});

            return runningResult.trim().toLowerCase() === "true" ? "running" : "stopped";

        } catch (error) {
            Console.error(`Error checking container status for ${identifier}:`, error);
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
                Console.debug(`${containerName} status:`, status);

                if (status === "running") {
                    Console.log(`Container ${containerName} is running!`);
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
    function prepareAndRunContainer(manifest, options) {

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

        //this applies to docker images that are built locally from a dockerfile
        if(manifest.config.dockerfile){
            // Build the image - Use absolute paths and set the working directory to root
            const dockerfilePath = path.resolve(root, manifest.config.dockerfile);
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

        const volumes = manifest.config.volumes
            .map( volume => `-v ${volume}`)
            .join(" ");

        Console.debug("volumeFlags", volumeFlags);
        Console.debug("volumes", volumes);

        const envVariablesPart = Object.entries(manifest.config.env)
            .map(([key, value]) => `-e ${key}=${value}`)
            .join(" ");

        const instanceNumber = new ObjectId().toString(); //mongoDb ID.

        /**
         * It will either leave the host port as a unique port if the maxInstances is one or less or nullish
         * otherwise it will create a range based on the maxInstances value:
         * ex: 8080-8090 when maxInstances is 10.
         * With the range, docker will assign the next available port in that range
         * @type {string|*}
         */
        let hostPort = manifest.config.external_port;
        let horizontalMaxInstances = manifest.scaling?.horizontal?.thresholds?.maxInstances;
        if(typeof horizontalMaxInstances === "number"){
            hostPort = hostPort+"-"+(manifest.config.external_port+horizontalMaxInstances).toString();
        }
        let ports = `-p ${hostPort}:${manifest.config.internal_port}`;

        let containerName = manifest.config.container_name+"-"+instanceNumber;

        // Run the container
        const runCommand = `docker run -d \\
          --name ${containerName} \\
          --label service.namespace=alkimia-workspace \\
          --label service.group=${manifest.name} \\
          --label service.instance=${instanceNumber} \\
          --network ${manifest.config.network} \\
          --add-host=server.alkimia.localhost:host-gateway \\
          --add-host=app.alkimia.localhost:host-gateway \\
          --add-host=stressagent.alkimia.localhost:host-gateway \\
          --cpus=1 \\
          --memory=512m \\
          ${ports} \\
          ${envVariablesPart} \\
          ${volumes} \\
          ${manifest.config.container_name}`;

        Console.debug("About to execute command", runCommand);

        execSync(runCommand, {
            stdio: "inherit"
        });

        return containerName;
    }

    /**
     *
     * @param {object} manifest
     * @param {object} options
     * @return {string}
     */
    function prepareAndRunMongoDb(manifest, options) {

        const {
            runningEnv="production",
            forceRestart=false
        } = options;

        //override ENV in manifest with the one from options
        manifest.config.env["ENV"] = runningEnv;

        // Ensure the network exists
        ensureNetworkExists(manifest.config.network);

        // Check container status
        const containerStatus = getContainerStatus(manifest.config.container_name);
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

        // Create a keyFile for replica set authentication
        const keyFilePath = path.resolve(configPath, "mongodb-keyfile");
        if (!fs.existsSync(keyFilePath)) {
            // Generate a secure random key
            execSync(`openssl rand -base64 756 > ${keyFilePath}`, { stdio: "inherit" });
            // Set proper permissions (MongoDB requires file permissions to be 400)
            execSync(`chmod 400 ${keyFilePath}`, { stdio: "inherit" });
        }


        let hostPort = manifest.config.external_port;
        let maxHorizontalInstances = manifest.scaling?.horizontal?.maxInstances;
        if(typeof maxHorizontalInstances === "number" && maxHorizontalInstances > 1){
            hostPort = hostPort+"-"+(maxHorizontalInstances).toString();
        }
        let ports = `-p ${hostPort}:${manifest.config.internal_port}`;


        const env = Object.entries(manifest.config.env)
            .map(([key, value]) => `-e ${key}=${value}`)
            .join(" ");

        const health_check = manifest.config.health_check
            .map( entry => `${entry}`)
            .join(" ");

        const additional_args = manifest.config.additional_args
            .map( entry => `${entry}`)
            .join(" ");

        // Create a new container with replica set support
        const runCommand = `docker run -d --name ${manifest.config.container_name} \\
                         --network ${manifest.config.network} \\
                         --label service.namespace=alkimia-workspace \\
                         --label service.group=${manifest.name} \\
                         ${ports}\\
                         ${env}\\
                         -v ${dataPath}:/data/db \\
                         -v ${keyFilePath}:/data/mongodb-keyfile \\
                         ${health_check}\\
                         ${manifest.config.image}\\
                         ${additional_args}`;

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
                const checkCommand = `docker exec ${manifest.config.container_name} mongosh -u mongoadmin -p secret --eval 'db.runCommand({ ping: 1 })' --quiet`;
                execSync(checkCommand, { stdio: "pipe" });

                // Check if the replica set is already initialized
                try {
                    const rsStatusCommand = `docker exec ${manifest.config.container_name} mongosh -u mongoadmin -p secret --eval 'rs.status().ok'`;
                    const rsStatusResult = execSync(rsStatusCommand, { stdio: "pipe" }).toString().trim();

                    if (rsStatusResult.includes("1")) {
                        Console.log("MongoDB: replica set is already initialized");
                        return true;
                    }
                } catch (rsError) {
                    // rs.status() will fail if replica set is not initialized, which is expected
                    Console.debug("Replica set not initialized yet, will initialize now", rsError.message);
                }

                Console.info("MongoDB: initializing replica set...");
                const initReplicaSet = `docker exec ${manifest.config.container_name} mongosh -u mongoadmin -p secret --eval 'rs.initiate({_id: "rs0", members: [{_id: 0, host: "localhost:27017"}]})'`;
                execSync(initReplicaSet, { stdio: "inherit" });
                return true;
            } catch (error) {
                Console.log("MongoDB not ready yet, retrying...", error.message);
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
                return Console.info("MongoDB: replica set initialized"); // Success
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


        let serviceManifest = manifest.services[manifest.ServiceIds.MQTT_BROKER];
        let hostPort = serviceManifest.config.external_port;
        let maxHorizontalInstances = serviceManifest.scaling?.horizontal?.maxInstances;
        if(typeof maxHorizontalInstances === "number" && maxHorizontalInstances > 1){
            hostPort = hostPort+"-"+(maxHorizontalInstances).toString();
        }
        let ports = `-p ${hostPort}:${serviceManifest.config.internal_port}`;


        // Create a new container - Use absolute paths
        const configPath = path.resolve(root, "services/mqtt/config");

        const runCommand = `docker run -d --name ${_brokerName} \\
                             --label service.namespace=alkimia-workspace \\
                             --label service.group=${serviceManifest.name} \\
                             --network ${networkName} \\
                             ${ports} \\
                             -p 9001:9001 \\
                             -v ${configPath}:/mosquitto/config \\
                             -v mqtt_data:/mosquitto/data \\
                             -v mqtt_log:/mosquitto/log \\
                             eclipse-mosquitto:latest`;

        Console.debug("about to exec runCommand for mqtt broker with:", runCommand);

        execSync(runCommand, {
            cwd: root,
            stdio: "inherit"
        });


        return "created_new";
    }

    /**
     * Extract the external port from a docker container json output
     * @param {string} portMapping - in the form "0.0.0.0:8084->3000/tcp"
     */
    function extractExternalPort(portMapping){

        if(Utilities.isNonemptyString(portMapping) ){
            // Regular expression to match the port number after the IP and colon, before the arrow
            const regex = /\d+\.\d+\.\d+\.\d+:(\d+)->/;
            const match = portMapping.match(regex);
            if (match && match[1]) {
                return parseInt(match[1], 10); // Convert to number and return
            }
        }

        return null; // Return null if no match found
    }

    /**
     *
     * @param {string} CreatedAt - date string as returned by docker query json format
     * @return {Date}
     */
    function convertContainerInfoDateIntoIsoDate(CreatedAt){
        let createdAt = CreatedAt.replace(/ [A-Z]{3,}$/, ""); // removes the 'CEST' part
        createdAt = createdAt.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
        const dt = DateTime.fromFormat(createdAt, "yyyy-MM-dd HH:mm:ss ZZ", { setZone: true });
        return dt.toJSDate();
    }

    // Expose methods on the instance
    instance.getContainersByFilter = getContainersByFilter;
    instance.getContainerStatus = getContainerStatus;
    instance.doesImageExist = doesImageExist;
    instance.doesNetworkExist = doesNetworkExist;
    instance.ensureNetworkExists = ensureNetworkExists;
    instance.buildBaseImage = buildBaseImage;
    instance.waitForContainerReady = waitForContainerReady;
    instance.waitUntilContainerIsHealthy = waitUntilContainerIsHealthy;
    instance.prepareAndRunContainer = prepareAndRunContainer;
    instance.prepareAndRunMongoDb = prepareAndRunMongoDb;
    instance.startMosquittoBroker = startMosquittoBroker;
    instance.stopAndRemoveContainer = stopAndRemoveContainer;
    instance.checkContainerRunning = checkContainerRunning;
    instance.getContainer = getContainer;
    instance.emitDockerEvent = emitDockerEvent;
    instance.getAllManifestContainers = getAllManifestContainers;
    instance.extractExternalPort = extractExternalPort;
    instance.convertContainerInfoDateIntoIsoDate = convertContainerInfoDateIntoIsoDate;


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

