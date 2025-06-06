import { exec, execSync } from "node:child_process";
import { EventEmitter } from "node:events";
import Console from "@intersides/console";
import {utilities as Utilities} from "@alkimia/lib";
import MongoDbService from "./MongoDbService.js";
import ServiceDispatcher from "./ServiceDispatcher.js";
import DockerManager from "../DockerManager.js";
import {setIntervalImmediate} from "@workspace/common/utils.js";
import mqtt from "mqtt";


/**
 * Service for monitoring Docker container performance metrics
 */
export default function ContainerMonitorService(_args=null) {
    const instance = Object.create(ContainerMonitorService.prototype);
    const emitter = new EventEmitter();

    const {
        /**
         * @type {MongoDbService}
         */
        mongoDbService,
        /**
         * @type {DockerManager}
         */
        dockerManager,
        /**
         * @type {ServiceDispatcher}
         */
        serviceDispatcher
    } = Utilities.transfer(_args, {
        mongoDbService:null,
        dockerManager:null,
        serviceDispatcher:null
    });

    let cpuMonitoringIntervals = {};

    let mqttClient =null;

    function _init(){
        mqttClient = mqtt.connect("mqtt://mqtt.alkimia.localhost:1883", {
            clientId: "proxy-server",
            clean: true
        });

        _registerEventListeners();
        return instance;
    }

    function _registerEventListeners(){

        mqttClient.on("connect", () => {
            Console.log("[MQTT] Connected");
        });

        mqttClient.on("message", (topic, payload) => {
            Console.log(`[MQTT] Topic: ${topic}, Message: ${payload.toString()}`);
        });

        mqttClient.on("error", err => {
            Console.error("[MQTT] Error:", err);
        });


        DockerManager.on("event", async function(event){
            Console.debug(`onEvent '${event.type}' from container event:`, event);

            switch(event.type){
                case "docker-container":{

                    switch(event.state ){

                        case "exec_start":{
                            const memoryUsage = await getContainerMemoryUsage(event.data.container_name);
                            const cpuUsage = await getContainerCpuUsage(event.data.container_name);

                            // let container = dockerManager.getContainer(event.data.container_name, "name");
                            mqttClient.publish("service/events", JSON.stringify({
                                id:event.data.container_id,
                                type:event.data.type,
                                name:event.data.container_name,
                                memory:memoryUsage,
                                cpu:cpuUsage
                            }));
                        }break;

                        case "start":{
                            if(event.data.manifest.monitored){
                                Console.info(`about to start cpu monitoring for : ${event.data.container_name}`);
                                monitorContainerCpu(event.data.container_name, 2000, 0, (state)=>{});
                            }
                        }break;

                        case "kill":
                        case "die":
                        case "destroy":{
                            if(event.data.manifest.monitored){
                                Console.warn(`about to stop cpu monitoring for : ${event.data.container_name}`);
                                stopMonitoringContainerCpu(event.data.container_name, (monitoringIntervalRef)=>{
                                    Console.debug(`Monitoring stopped for ${monitoringIntervalRef} monitoringIntervalRef:`, monitoringIntervalRef);
                                });
                            }
                        }break;

                        default:{
                            Console.debug(`event type:${event.type} in state:${event.state} not considered`);
                        }
                    }


                }break;
                default:{
                    Console.warn("not dealing with event type :", event.type);
                }break;
            }
        });

    }



    /**
     * Get CPU usage percentage for a running container
     * @param {string} containerName - Name of the container to monitor
     * @returns {Promise<number>} - CPU usage percentage or -1 if error
     */
    async function getContainerCpuUsage(containerName) {
        try {
            // Get container stats in JSON format
            const statsCommand = `docker stats ${containerName} --no-stream --format "{{.CPUPerc}}"`;
            const result = await runCommand(statsCommand);

            // Parse the CPU percentage (format is like "5.26%")
            const cpuPercent = parseFloat(result.replace("%", ""));
            return cpuPercent;
        } catch (error) {
            Console.error(`Error getting CPU usage for ${containerName}:`, error);
            return -1; // Return -1 to indicate error
        }
    }

    /**
     * Get memory usage for a running container
     * @param {string} containerName - Name of the container to monitor
     * @returns {Promise<Object>} - Memory usage object with used, limit and percentage
     */
    async function getContainerMemoryUsage(containerName) {
        try {
            // Get memory usage and limit
            const memCommand = `docker stats ${containerName} --no-stream --format "{{.MemUsage}}"`;
            const result = await runCommand(memCommand);
            
            // Parse the memory usage (format is like "50MiB / 2GiB")
            const [used, limit] = result.split(" / ");
            
            // Convert to bytes for consistent comparison
            const usedBytes = convertToBytes(used);
            const limitBytes = convertToBytes(limit);
            
            // Calculate percentage
            const percentage = (usedBytes / limitBytes) * 100;
            
            return {
                used,
                limit,
                usedBytes,
                limitBytes,
                percentage
            };
        } catch (error) {
            Console.error(`Error getting memory usage for ${containerName}:`, error);
            return null;
        }
    }

    /**
     * Helper function to convert memory strings (like 50MiB, 2GiB) to bytes
     * @param {string} memoryString - Memory string to convert
     * @returns {number} - Memory in bytes
     */
    function convertToBytes(memoryString) {
        const units = {
            "B": 1,
            "KiB": 1024,
            "MiB": 1024 * 1024,
            "GiB": 1024 * 1024 * 1024,
            "TiB": 1024 * 1024 * 1024 * 1024
        };
        
        
        const match = memoryString.match(/^([\d.]+)([A-Za-z]+)$/);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2];
        
        return value * (units[unit] || 1);
    }

    /**
     * Run a command and return its output
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


    function stopMonitoringContainerCpu(containerName, _callback){
        clearInterval(cpuMonitoringIntervals[containerName]);
        if(_callback){
            _callback(cpuMonitoringIntervals[containerName]);
        }
    }

    /**
     * Monitor container CPU usage at regular intervals
     * @param {string} containerName - Name of the container to monitor
     * @param {number} intervalMs - Monitoring interval in milliseconds
     * @param {number} durationMs - Total monitoring duration in milliseconds (0 for indefinite)
     * @param {function} callback - Callback function(reading)
     * @returns {object} - Monitor Control Object with stop() method
     */
    function monitorContainerCpu(containerName, intervalMs = 1000, durationMs = 0, callback, panicThreshold=80) {

        const startTime = Date.now();
        const monitorData = {
            containerName,
            readings: [],
            startTime,
            intervalMs,
            isRunning: true
        };


        let container = dockerManager.getContainer(containerName, "name");
        let serviceGroup = container?.["Config"]["Labels"]["service.group"];

        async function cpuMonitoringProcedure(
            _containerName,
            _panicThreshold,
            _monitorData,
            _startTime,
            _serviceGroup,
            _durationMs){
            if (!_monitorData.isRunning) {
                stopMonitoringContainerCpu(_containerName);
                return;
            }

            const cpuPercent = await getContainerCpuUsage(_containerName);
            const timestamp = Date.now();

            const reading = {
                container:_containerName,
                cpuPercent,
                timestamp,
                panic:cpuPercent > _panicThreshold,
                elapsedMs: timestamp - _startTime
            };

            if(reading.panic){

                Console.warn("a service state is into panic!");

                //check for previous panic instances
                let untreatedEvent = await mongoDbService.getEvent("service_panic", { container:reading.container, status:"UNTREATED" });
                if(!untreatedEvent){
                    mongoDbService.storeEvent("service_panic", {...reading, status:"UNTREATED"});
                }
                else{
                    Console.info("untreatedEvent", untreatedEvent);
                }

                //spawn the same service !!
                if(serviceDispatcher.checkScalingCondition(_serviceGroup)){
                    Console.debug(_containerName, "should scale up" );
                }

            }

            mongoDbService.upsertMonitoringEvent(reading);

            _monitorData.readings.push(reading);

            // Check if monitoring duration has elapsed
            if (_durationMs > 0 && timestamp - _startTime >= _durationMs) {
                _monitorData.isRunning = false;
                stopMonitoringContainerCpu(_containerName);
                Console.log(`CPU monitoring for ${_containerName} completed`);
                emitter.emit("monitoring-completed", {
                    containerName: _containerName,
                    readings: _monitorData.readings
                });
            }
        }

        cpuMonitoringIntervals[containerName] = setIntervalImmediate(
            async () => {
                await cpuMonitoringProcedure(
                    containerName,
                    panicThreshold,
                    monitorData,
                    startTime,
                    serviceGroup,
                    durationMs
                );
            },
            intervalMs
        );


        // Return control object
        return {
            stop: () => {
                monitorData.isRunning = false;
                clearInterval(cpuMonitoringIntervals[containerName]);
                Console.log(`CPU monitoring for ${containerName} stopped`);
                emitter.emit("monitoring-stopped", {
                    containerName,
                    readings: monitorData.readings
                });
                return monitorData.readings;
            },
            getData: () => {
                return monitorData.readings;
            }
        };
    }

    /**
     * Monitor container memory usage at regular intervals
     * @param {string} containerName - Name of the container to monitor
     * @param {number} intervalMs - Monitoring interval in milliseconds
     * @param {number} durationMs - Total monitoring duration in milliseconds (0 for indefinite)
     * @param {function} callback - Callback function(reading)
     * @returns {object} - Monitor Control Object with stop() method
     */
    function monitorContainerMemory(containerName, intervalMs = 1000, durationMs = 0, callback) {

        Console.log(`Starting memory monitoring for ${containerName}`);

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

            const memoryUsage = await getContainerMemoryUsage(containerName);
            const timestamp = Date.now();

            // Store the reading
            const reading = {
                memoryUsage,
                timestamp,
                elapsedMs: timestamp - startTime
            };
            monitorData.readings.push(reading);

            // Check if monitoring duration has elapsed
            if (durationMs > 0 && timestamp - startTime >= durationMs) {
                monitorData.isRunning = false;
                clearInterval(intervalId);
                Console.log(`Memory monitoring for ${containerName} completed`);
                emitter.emit("monitoring-completed", {
                    containerName,
                    readings: monitorData.readings
                });
            }
        }, intervalMs);

        // Return control object
        return {
            stop: () => {
                monitorData.isRunning = false;
                clearInterval(intervalId);
                Console.log(`Memory monitoring for ${containerName} stopped`);
                emitter.emit("monitoring-stopped", {
                    containerName,
                    readings: monitorData.readings
                });
                return monitorData.readings;
            },
            getData: () => {
                return monitorData.readings;
            }
        };
    }

    /**
     * Monitor both CPU and memory for a container for a specified duration
     * @param {string} containerName - Container to monitor
     * @param {number} durationMs - Duration in milliseconds
     * @param {number} intervalMs - Interval between readings in milliseconds
     * @returns {Promise<Object>} - Monitoring results with CPU and memory data
     */
    function monitorContainerPerformance(containerName, durationMs = 60000, intervalMs = 1000) {
        return new Promise((resolve) => {
            const results = {
                cpu: [],
                memory: []
            };
            
            const cpuMonitor = monitorContainerCpu(
                containerName,
                intervalMs,
                durationMs,
                (reading) => {
                    results.cpu.push(reading);
                    Console.log(`${containerName} CPU: ${reading.cpuPercent.toFixed(2)}%`);
                }
            );
            
            const memMonitor = monitorContainerMemory(
                containerName,
                intervalMs,
                durationMs,
                (reading) => {
                    results.memory.push(reading);
                    if (reading.memoryUsage) {
                        Console.log(`${containerName} Memory: ${reading.memoryUsage.used} / ${reading.memoryUsage.limit} (${reading.memoryUsage.percentage.toFixed(2)}%)`);
                    }
                }
            );
            
            // Resolve after duration
            setTimeout(() => {
                cpuMonitor.stop();
                memMonitor.stop();
                
                // Calculate averages
                const avgCpu = results.cpu.reduce((sum, r) => sum + r.cpuPercent, 0) / results.cpu.length;
                
                const avgMemPercent = results.memory
                    .filter(r => r.memoryUsage)
                    .reduce((sum, r) => sum + r.memoryUsage.percentage, 0) / 
                    results.memory.filter(r => r.memoryUsage).length;
                
                Console.log(`Average CPU usage: ${avgCpu.toFixed(2)}%`);
                Console.log(`Average Memory usage: ${avgMemPercent.toFixed(2)}%`);
                
                resolve({
                    containerName,
                    duration: durationMs,
                    interval: intervalMs,
                    readings: results,
                    summary: {
                        avgCpuPercent: avgCpu,
                        avgMemoryPercent: avgMemPercent
                    }
                });
            }, durationMs);
        });
    }

    /**
     * Run a quick performance check on a container
     * @param {string} containerName - Container to check
     * @returns {Promise<Object>} - Current CPU and memory usage
     */
    async function checkContainerPerformance(containerName) {
        const cpuPercent = await getContainerCpuUsage(containerName);
        const memoryUsage = await getContainerMemoryUsage(containerName);
        
        Console.log(`Current CPU usage for ${containerName}: ${cpuPercent.toFixed(2)}%`);
        if (memoryUsage) {
            Console.log(`Current Memory usage for ${containerName}: ${memoryUsage.used} / ${memoryUsage.limit} (${memoryUsage.percentage.toFixed(2)}%)`);
        }
        
        return {
            containerName,
            timestamp: Date.now(),
            cpu: cpuPercent,
            memory: memoryUsage
        };
    }

    /**
     *
     * @param manifestService
     * @param options
     * @return {Promise<object>} //returning the service instance that can handle the request
     */
    function ensureServiceAvailable(manifestService, options) {

        return new Promise(async (resolve, reject) => {
            const { type, config } = manifestService;
            const { ENV } = options;

            if (type === "docker-service") {

                Console.debug(`Handling docker service: ${config.container_name}`);

                let containers = dockerManager.getContainersByFilter(config.container_name, "group", "running");
                const isRunning = containers?.length > 0;
                if (!isRunning) {
                    Console.debug("Container not running. Preparing and running container...");
                    let containerName = dockerManager.prepareAndRunContainer(manifestService, {
                        runningEnv: ENV,
                        forceRestart: false
                    });

                    // Wait for container readiness
                    await dockerManager.waitForContainerReady(containerName);
                    const isHealthy = await dockerManager.waitUntilContainerIsHealthy(containerName);
                    if (!isHealthy) {
                        throw new Error(`Container ${containerName} failed health checks`);
                    }
                    else{
                        Console.info(`container ${containerName} is healthy`);
                        //once the container is healthy it should be added to a register of running containers and tagged by an instance id
                    }
                }
                // If the container is running or successfully started, invoke proxy callback
                resolve();
            } else {
                reject(new Error(`Unsupported service type: ${type}`));
            }
        });

    }

    instance.ensureServiceAvailable = ensureServiceAvailable;

    // Expose public methods
    instance.getContainerCpuUsage = getContainerCpuUsage;
    instance.getContainerMemoryUsage = getContainerMemoryUsage;
    instance.checkContainerPerformance = checkContainerPerformance;
    instance.monitorContainerCpu = monitorContainerCpu;
    instance.monitorContainerMemory = monitorContainerMemory;
    instance.monitorContainerPerformance = monitorContainerPerformance;

    // Event handling
    instance.on = (event, listener) => emitter.on(event, listener);
    instance.off = (event, listener) => emitter.off(event, listener);
    instance.once = (event, listener) => emitter.once(event, listener);

    return _init();
}

// Singleton pattern
let _instance = null;

ContainerMonitorService.getSingleton = function() {
    if (!_instance) {
        _instance = ContainerMonitorService();
    }
    return _instance;
};

