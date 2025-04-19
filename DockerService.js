import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function DockerService(_args = null){

    const instance = Object.create(DockerService.prototype);

    const {} = Utilities.transfer(_args, {});

    // Load environment variables from .env file
    const envFile = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    const envVars = {};

    const emitter = new EventEmitter();

    envFile.split("\n").forEach(line => {
        if(line && !line.startsWith("#")){
            const [key, value] = line.split("=");
            if(key && value){
                envVars[key.trim()] = value.trim();
            }
        }
    });

    function _init(){
        return instance;
    }

    // Wait for the container to be ready
    function waitForContainerReady(containerName){
        console.log(`Waiting for container ${containerName} to be ready...`);

        // Simple approach: wait a few seconds
        return new Promise(resolve => {
            setTimeout(() => {
                checkContainerRunning(containerName).then(isRunning => {
                    if(isRunning){
                        console.log(`Container ${containerName} is ready!`);
                        resolve();
                    }
                    else{
                        console.error(`Container ${containerName} is not running`);
                        throw new Error(`Container ${containerName} start timeout error`);
                    }
                });
            }, 3000); // Wait 3 seconds
        });
    }

    // Check if the container is running
    function checkContainerRunning(containerName){

        return runCommand(`docker inspect -f '{{.State.Running}}' ${containerName}`).then(output => output.includes("true")).catch(() => false);
    }

    /**
     *
     * @param containerName
     * @return {boolean}
     */
    function containerIsRunning(containerName){
        let isRunning = "false";
        try{
            isRunning = execSync(`docker inspect -f '{{.State.Running}}' ${containerName}`, {encoding: 'utf8'});
        }
        catch(e){
            console.error(e.message);
        }
        return isRunning.trim().toLowerCase() === "true";
    }

    // Stop and remove a container
    function stopContainer(containerName){
        console.log(`Stopping container ${containerName}...`);
        execSync(`docker rm -f ${containerName} || true`, {stdio: "inherit"});
    }

    function runCommand(command){
        return new Promise((resolve, reject) => {

            exec(command, (error, stdout, stderr) => {
                if(error){
                    console.error(`Error: ${stderr}`);
                    reject(error);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }


    /**
     * Get CPU usage percentage for a running container
     * @param {string} containerName - Name of the container to monitor
     * @returns {Promise<number>} - CPU usage percentage
     */
    async function getContainerCpuUsage(containerName) {
        try {
            // Get container stats in JSON format
            const statsCommand = `docker stats ${containerName} --no-stream --format "{{.CPUPerc}}"`;
            const result = await runCommand(statsCommand);

            // Parse the CPU percentage (format is like "5.26%")
            const cpuPercent = parseFloat(result.replace('%', ''));
            return cpuPercent;
        } catch (error) {
            console.error(`Error getting CPU usage for ${containerName}:`, error);
            return -1; // Return -1 to indicate error
        }
    }

    function monitorFor60Seconds(containerName) {
        // const containerName = 'alkimia-frontend';

        const monitor = monitorContainerCpu(
            containerName,
            1000, // Check every second
            60000, // Monitor for 60 seconds
            (reading) => {
                console.log(`${containerName} CPU: ${reading.cpuPercent.toFixed(2)}%`);
            }
        );

        // If you need to stop monitoring early
        setTimeout(() => {
            const readings = monitor.stop();
            console.log('Monitoring stopped. Readings:', readings);

            // Calculate average CPU usage
            const avgCpu = readings.reduce((sum, r) => sum + r.cpuPercent, 0) / readings.length;
            console.log(`Average CPU usage: ${avgCpu.toFixed(2)}%`);
        }, 30000); // Stop after 30 seconds
    }

    // Example 1: Simple one-time CPU check
    async function checkCpu() {
        const containerName = 'alkimia-frontend';
        const cpuPercent = await getContainerCpuUsage(containerName);
        console.log(`Current CPU usage for ${containerName}: ${cpuPercent.toFixed(2)}%`);
    }

    /**
     * Monitor container CPU usage at regular intervals
     * @param {string} containerName - Name of the container to monitor
     * @param {number} intervalMs - Monitoring interval in milliseconds
     * @param {number} durationMs - Total monitoring duration in milliseconds (0 for indefinite)
     * @param {function} callback - Callback function(cpuPercent, timestamp)
     * @returns {object} - Monitor control object with stop() method
     */
    function monitorContainerCpu(containerName, intervalMs = 1000, durationMs = 0, callback) {
        console.log(`Starting CPU monitoring for ${containerName}`);

        const startTime = Date.now();
        const monitorData = {
            containerName,
            readings: [],
            startTime,
            intervalMs,
            isRunning: true
        };

        // Create monitoring interval
        const intervalId = setInterval(async () => {
            if (!monitorData.isRunning) {
                clearInterval(intervalId);
                return;
            }

            const cpuPercent = await getContainerCpuUsage(containerName);
            const timestamp = Date.now();

            // Store the reading
            const reading = {
                cpuPercent,
                timestamp,
                elapsedMs: timestamp - startTime
            };
            monitorData.readings.push(reading);

            // Call the callback if provided
            if (typeof callback === 'function') {
                callback(reading);
            }

            // Check if monitoring duration has elapsed
            if (durationMs > 0 && timestamp - startTime >= durationMs) {
                monitorData.isRunning = false;
                clearInterval(intervalId);
                console.log(`CPU monitoring for ${containerName} completed`);
            }
        }, intervalMs);

        // Return control object
        return {
            stop: () => {
                monitorData.isRunning = false;
                clearInterval(intervalId);
                console.log(`CPU monitoring for ${containerName} stopped`);
                return monitorData.readings;
            },
            getData: () => {
                return monitorData.readings;
            }
        };
    }

    function startContainer(name, service, port, forceRestart=false){

        let isRunning = containerIsRunning('alkimia-backend');
        if(isRunning && forceRestart){
            stopContainer(name);
        }
        else if(isRunning){
            console.info(`container ${name} is already running`);
            return;
        }

        console.log(`Starting container ...`, __dirname);

        let ENV = "development";

        const buildCommand = `docker build . -t ${name} \
          --build-arg SERVICE=${service} \
          --build-arg ENV=${ENV}`;

        execSync(buildCommand, {
            cwd: __dirname, // ensures Docker context is correct
            stdio: "inherit" // streams output live to the console
        });

        let volumeFlags = [
            `-v /app/node_modules`,
            `-v /app/dist`
        ];
        if(ENV === "development"){
            // const root = process.cwd();
            volumeFlags.push(`-v ${__dirname}/apps/${service}:/app`);
            volumeFlags.push(`-v ${__dirname}/libs:/app/libs`);
        }
        volumeFlags = volumeFlags.join(" ");

        const runCommand = `docker run -d \
          --name ${name} \
          -p ${port}:${envVars.DOCKER_FILE_PORT} \
          -e ENV=${ENV} \
          -e PROTOCOL=${envVars.PROTOCOL} \
          -e DOMAIN=${envVars.DOMAIN}\
          -e SUBDOMAIN=${service} \
          ${volumeFlags} \
          ${name}`;

        console.debug("about to execute command", runCommand);

        execSync(runCommand, {
            stdio: "inherit"
        });

        emitter.emit("container-started", {
            name: name,
            env: ENV,
            domain: envVars.DOMAIN,
            service: service,
            port: port
        });

    }

    instance.monitorFor60Seconds = monitorFor60Seconds;
    instance.containerIsRunning = containerIsRunning;
    instance.waitForContainerReady = waitForContainerReady;
    instance.startContainer = startContainer;
    instance.stopContainer = stopContainer;
    instance.checkContainerRunning = checkContainerRunning;
    instance.on = (event, listener) => emitter.on(event, listener);
    // instance.once =  (event, listener) => emitter.once(event, listener);
    // instance.off =  (event, listener) => emitter.off(event, listener);

    return _init();

}

let _instance = null;

/**
 *
 * @return {DockerService}
 */
DockerService.getSingleton = function(_args = null){
    if(!_instance){
        _instance = DockerService(_args);
    }
    return _instance;
};

/**
 *
 * @return {DockerService}
 */
DockerService.getInstance = function(_args = null){
    return DockerService(_args);
};
