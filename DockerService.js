import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import Console from "@intersides/console";

export default function DockerService(_args = null){

    const instance = Object.create(DockerService.prototype);

    const {
        envVars
    } = Utilities.transfer(_args, {
        envVars:null
    });

    const emitter = new EventEmitter();

    function _init(){

        return instance;
    }

    function runCommand(command){
        return new Promise((resolve, reject) => {

            exec(command, (error, stdout, stderr) => {
                if(error){
                    Console.error(`Error: ${stderr}`);
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
    async function getContainerCpuUsage(containerName){
        try{
            // Get container stats in JSON format
            const statsCommand = `docker stats ${containerName} --no-stream --format "{{.CPUPerc}}"`;
            const result = await runCommand(statsCommand);

            // Parse the CPU percentage (format is like "5.26%")
            const cpuPercent = parseFloat(result.replace("%", ""));
            return cpuPercent;
        }
        catch(error){
            Console.error(`Error getting CPU usage for ${containerName}:`, error);
            return -1; // Return -1 to indicate error
        }
    }

    // function monitorFor60Seconds(containerName){
    //     // const containerName = 'alkimia-frontend';
    //
    //     const monitor = monitorContainerCpu(
    //         containerName,
    //         1000, // Check every second
    //         60000, // Monitor for 60 seconds
    //         (reading) => {
    //             Console.log(`${containerName} CPU: ${reading.cpuPercent.toFixed(2)}%`);
    //         }
    //     );
    //
    //     // If you need to stop monitoring early
    //     setTimeout(() => {
    //         const readings = monitor.stop();
    //         Console.log("Monitoring stopped. Readings:", readings);
    //
    //         // Calculate average CPU usage
    //         const avgCpu = readings.reduce((sum, r) => sum + r.cpuPercent, 0) / readings.length;
    //         Console.log(`Average CPU usage: ${avgCpu.toFixed(2)}%`);
    //     }, 30000); // Stop after 30 seconds
    // }

    // Example 1: Simple one-time CPU check
    // async function checkCpu(){
    //     const containerName = "alkimia-frontend";
    //     const cpuPercent = await getContainerCpuUsage(containerName);
    //     Console.log(`Current CPU usage for ${containerName}: ${cpuPercent.toFixed(2)}%`);
    // }

    /**
     * Monitor container CPU usage at regular intervals
     * @param {string} containerName - Name of the container to monitor
     * @param {number} intervalMs - Monitoring interval in milliseconds
     * @param {number} durationMs - Total monitoring duration in milliseconds (0 for indefinite)
     * @param {function} callback - Callback function(cpuPercent, timestamp)
     * @returns {object} - Monitor control object with stop() method
     */
    // function monitorContainerCpu(containerName, intervalMs = 1000, durationMs = 0, callback){
    //     Console.log(`Starting CPU monitoring for ${containerName}`);
    //
    //     const startTime = Date.now();
    //     const monitorData = {
    //         containerName,
    //         readings: [],
    //         startTime,
    //         intervalMs,
    //         isRunning: true
    //     };
    //
    //     // Create monitoring interval
    //     const intervalId = setInterval(async() => {
    //         if(!monitorData.isRunning){
    //             clearInterval(intervalId);
    //             return;
    //         }
    //
    //         const cpuPercent = await getContainerCpuUsage(containerName);
    //         const timestamp = Date.now();
    //
    //         // Store the reading
    //         const reading = {
    //             cpuPercent,
    //             timestamp,
    //             elapsedMs: timestamp - startTime
    //         };
    //         monitorData.readings.push(reading);
    //
    //         // Call the callback if provided
    //         if(typeof callback === "function"){
    //             callback(reading);
    //         }
    //
    //         // Check if monitoring duration has elapsed
    //         if(durationMs > 0 && timestamp - startTime >= durationMs){
    //             monitorData.isRunning = false;
    //             clearInterval(intervalId);
    //             Console.log(`CPU monitoring for ${containerName} completed`);
    //         }
    //     }, intervalMs);
    //
    //     // Return control object
    //     return {
    //         stop: () => {
    //             monitorData.isRunning = false;
    //             clearInterval(intervalId);
    //             Console.log(`CPU monitoring for ${containerName} stopped`);
    //             return monitorData.readings;
    //         },
    //         getData: () => {
    //             return monitorData.readings;
    //         }
    //     };
    // }

    // instance.monitorFor60Seconds = monitorFor60Seconds;
    // instance.checkCpu = checkCpu;


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
