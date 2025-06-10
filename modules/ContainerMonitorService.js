import { exec, execSync } from "node:child_process";
import { EventEmitter } from "node:events";
import Console from "@intersides/console";
import {utilities as Utilities} from "@alkimia/lib";
import MongoDbService from "./MongoDbService.js";
import ServiceDispatcher from "./ServiceDispatcher.js";
import DockerManager from "../DockerManager.js";
import {setIntervalImmediate} from "@workspace/common/utils.js";
import mqtt from "mqtt";
import fs from "node:fs";


/**
 * Service for monitoring Docker container performance metrics
 */
export default function ContainerMonitorService(_args=null) {
    const instance = Object.create(ContainerMonitorService.prototype);
    const emitter = new EventEmitter();

    const kPanicThreshold = 95;
    const kStressThreshold = 80;
    const kCooldownMs = 30_000;// (30 seconds)

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

    // let cpuMonitoringIntervals = {};
    let serviceMonitoring = {};

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

                            let panicThreshold = event.data.manifest?.scaling?.horizontal?.thresholds?.cpuPercent?.panic || kPanicThreshold;
                            let stressThreshold = event.data.manifest?.scaling?.horizontal?.thresholds?.cpuPercent?.stress || kStressThreshold;

                            let status = "healthy";
                            if(cpuUsage > stressThreshold && cpuUsage < panicThreshold){
                                status = "stressed";
                            }
                            else if(cpuUsage > kPanicThreshold){
                                status = "panic";
                            }

                            if(!Object.hasOwn(serviceMonitoring, event.data.manifest.name)){
                                serviceMonitoring[event.data.manifest.name] = {
                                    scalingEvents:[],
                                    instances:{}
                                };
                            }

                            if(!Object.hasOwn(serviceMonitoring[event.data.manifest.name].instances, event.data.container_name)){
                                serviceMonitoring[event.data.manifest.name].instances[event.data.container_name] = [];
                            }

                            serviceMonitoring[event.data.manifest.name].instances[event.data.container_name].push({
                                status,
                                cpuUsage,
                                time:new Date()
                            });

                            //NOTE: **************** remove after concept is approved ****************
                            fs.writeFile("event-matrix.json", JSON.stringify(serviceMonitoring, null, 4), {encoding:"utf-8"},  function(err){
                                if(err){
                                    Console.error(err);
                                }
                                fs.readFile("event-matrix.json", "utf8", (err, data) => {
                                    if (err){
                                        return Console.error(err);
                                    }
                                });
                            });
                            //NOTE: **************** - ****************

                            if(event.data.manifest?.scaling){
                                checkScalingCondition(event.data.manifest);
                            }

                            // let container = dockerManager.getContainer(event.data.container_name, "name");
                            mqttClient.publish("service/events", JSON.stringify({
                                id:event.data.container_id,
                                type:event.data.type,
                                name:event.data.container_name,
                                memory:memoryUsage,
                                status,
                                cpu:cpuUsage
                            }));

                        }break;

                        case "start":{
                            if(event.data.manifest.monitored){
                                Console.info(`about to start cpu monitoring for : ${event.data.container_name}`);
                                // monitorContainerCpu(event.data.container_name, 2000, 0, (state)=>{});
                            }
                        }break;

                        case "kill":
                        case "die":
                        case "destroy":{
                            if(event.data.manifest.monitored){
                                Console.warn(`about to stop cpu monitoring for : ${event.data.container_name}`);
                                // stopMonitoringContainerCpu(event.data.container_name, (monitoringIntervalRef)=>{
                                //     Console.debug(`Monitoring stopped for ${monitoringIntervalRef} monitoringIntervalRef:`, monitoringIntervalRef);
                                // });
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

    function checkScalingCondition(manifest){

        Console.debug(`!!checkScalingCondition for ${manifest.config.container_name}:`);


        //grab the latest 60s entries, if
        let consistencyWindow = 12; //12 represents 5 seconds each by 12 60 seconds (at least 1 minute of monitoring)
        //NOTE setting to 3 to speed up the process during development
        consistencyWindow = 3;

        let shouldScale = haveAllContainersSettledInStatus(manifest.config.container_name, "panic", consistencyWindow, serviceMonitoring);
        if(shouldScale === null){
            return Console.error("failed to container status verification.");
        }

        if(shouldScale){
            Console.error("scale decision: it is time to scale up !");

            //verify that a previous event of the same type has been given the time to stabilise.
            let scaleUpPreviousEvents = serviceMonitoring[manifest.config.container_name].scalingEvents.filter(event=>event.type==="scale_up").pop();
            if(scaleUpPreviousEvents){
                if (Date.now() - scaleUpPreviousEvents.timestamp < kCooldownMs) {
                    Console.warn("waiting for previous event to cool down");
                    return; // skip evaluation
                }
            }

            let containerName = dockerManager.prepareAndRunContainer(manifest, {
                runningEnv: "development",
                forceRestart: false
            });

            serviceMonitoring[manifest.config.container_name].scalingEvents.push({
                type:"scale_up",
                timestamp: new Date()
            });

            //need to mark this scale up operation somehow to prevent to be triggered again too early
            // Console.debug(serviceMonitoring[manifest.config.container_name][]);

            // Wait for container readiness
            dockerManager.waitForContainerReady(containerName).then(()=>{
                dockerManager.waitUntilContainerIsHealthy(containerName).then(isHealthy=>{
                    if (!isHealthy) {
                        throw new Error(`Container ${containerName} failed health checks`);
                    }
                    else{
                        Console.info(`container ${containerName} is healthy`);
                        //once the container is healthy, it should be added to a register of running containers and tagged by an instance id
                    }

                });
            });

        }
        else{
            Console.warn("scale decision: no need to scale");
        }


    }

    /**
     * Evaluates whether all containers within a given service group have
     * consistently reported the same status (e.g., 'panic') over their most
     * recent state updates.
     *
     * The method checks the `containersStatesHistory` object, which holds
     * arrays of timestamped state entries per container, grouped by service.
     *
     * @param {string} groupName - The name of the service group (e.g., 'alkimia-backend').
     * @param {string} statusType - The target status to verify consistency for (e.g., 'panic').
     * @param {number} consistencyWindow - The number of most recent entries to check per container.
     * @param {object} containersStatesHistory - A nested object containing state history:
     *        {
     *          [groupName]: {
     *              scalingEvents:[...]
     *              instances:{
     *                  [containerId]: [ { status: string, time: string, cpuUsage: number }, ... ]
     *              }
     *          }
     *        }
     *
     * @returns {boolean|null} True if all containers in the group are in the specified status
     *                    for the full length of the consistency window.
     *
     * This method is used as a scaling trigger condition — for example, if all containers
     * in a group are in 'panic' consistently, this could indicate the need to scale up.
     */
    function haveAllContainersSettledInStatus(groupName, statusType, consistencyWindow, containersStatesHistory) {

        const groupHistory = containersStatesHistory[groupName];

        if (!groupHistory){
            Console.error("Containers States History has no group ", groupName);
            return null;
        }

        return Object.entries(groupHistory.instances).map(([containerName, history]) => {
            return {
                name: containerName,
                consistentlyInState: history.slice(-consistencyWindow).every(entry => entry.status === statusType)
            };
        }).every(entry => entry.consistentlyInState === true);
    }


    function bestCandidateContainer(serviceManifest){

        //grab the latest 60s entries, if
        let consistencyWindow = 12; //12 represents 5 seconds each by 12 60 seconds (at least 1 minute of monitoring)
        //NOTE setting to 3 to speed up the process during development
        consistencyWindow = 3;

        let areThereHealthyInstances = haveAllContainersSettledInStatus(serviceManifest.config.container_name, "healthy", consistencyWindow, serviceMonitoring);
        if(areThereHealthyInstances === null){
            return Console.error("failed to check for healthy container status.");
        }

        if(areThereHealthyInstances){
            //TODO which one should be chosen from the eventually healthy containers?
        }


        let containers = dockerManager.getContainersByFilter(serviceManifest.config.container_name, "group");

        let containersSiblings = containers.map(container=>container["Names"]);

        Console.debug("!!containers", containersSiblings);

        for(const sibling of containersSiblings){
            if(serviceMonitoring[sibling["Names"]]){
                //grab the latest 60s entries, if
                if(serviceMonitoring[sibling["Names"]].length > 3){
                    Console.warn("scale decision: have enough entries to grab");
                    let lastMinuteEntries = serviceMonitoring[sibling["Names"]].slice(-3);
                    let itemsInPanic = lastMinuteEntries.filter(entry=>entry.status === "panic");
                    if(itemsInPanic.length >= 3){
                        Console.error("scale decision: it is time to scale up !");

                        let containerName = dockerManager.prepareAndRunContainer(manifest, {
                            runningEnv: "development",
                            forceRestart: false
                        });

                        // Wait for container readiness
                        dockerManager.waitForContainerReady(containerName).then(()=>{
                            dockerManager.waitUntilContainerIsHealthy(containerName).then(isHealthy=>{
                                if (!isHealthy) {
                                    throw new Error(`Container ${containerName} failed health checks`);
                                }
                                else{
                                    Console.info(`container ${containerName} is healthy`);
                                    //once the container is healthy it should be added to a register of running containers and tagged by an instance id
                                }

                            });
                        });


                    }
                    else{
                        Console.warn(`scale decision: it is NOT time to scale up [${itemsInPanic.length}] ! [${itemsInPanic}]`);
                    }
                }
                else{
                    Console.warn("scale decision: still not enough", serviceMonitoring[sibling["Names"]].length);
                }
            }
        }

        //TODO: improve the algorithm to determine the best service from the group
        let container = null;
        if(containers?.length > 0){
            //TODO: this is not enough... it must determine the best candidate container
            //NOTE at the moment it is taking the first only
            container = containers[0];
        }
        else{
            Console.error("no containers running under the group ", serviceManifest.config.container_name);
        }

        return container;

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
            Console.debug("!!getContainerCpuUsage.cpuPercent", cpuPercent);
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


    // function stopMonitoringContainerCpu(containerName, _callback){
    //     clearInterval(cpuMonitoringIntervals[containerName]);
    //     if(_callback){
    //         _callback(cpuMonitoringIntervals[containerName]);
    //     }
    // }

    /**
     * Monitor container CPU usage at regular intervals
     * @param {string} containerName - Name of the container to monitor
     * @param {number} intervalMs - Monitoring interval in milliseconds
     * @param {number} durationMs - Total monitoring duration in milliseconds (0 for indefinite)
     * @param {function} callback - Callback function(reading)
     * @param {number} _panicThreshold
     * @returns {object} - Monitor Control Object with stop() method
     */
    // function monitorContainerCpu(containerName, intervalMs = 1000, durationMs = 0, callback, _panicThreshold=80) {
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
    //
    //     let container = dockerManager.getContainer(containerName, "name");
    //     let serviceGroup = container?.["Config"]["Labels"]["service.group"];
    //
    //     // async function cpuMonitoringProcedure(
    //     //     _containerName,
    //     //     _panicThreshold,
    //     //     _monitorData,
    //     //     _startTime,
    //     //     _serviceGroup,
    //     //     _durationMs){
    //     //     if (!_monitorData.isRunning) {
    //     //         stopMonitoringContainerCpu(_containerName);
    //     //         return;
    //     //     }
    //     //
    //     //     const cpuPercent = await getContainerCpuUsage(_containerName);
    //     //     const timestamp = Date.now();
    //     //
    //     //     const reading = {
    //     //         container:_containerName,
    //     //         cpuPercent,
    //     //         timestamp,
    //     //         panic:cpuPercent > _panicThreshold,
    //     //         elapsedMs: timestamp - _startTime
    //     //     };
    //     //
    //     //     if(reading.panic){
    //     //
    //     //         Console.warn("a service state is into panic!");
    //     //
    //     //         //check for previous panic instances
    //     //         let untreatedEvent = await mongoDbService.getEvent("service_panic", { container:reading.container, status:"UNTREATED" });
    //     //         if(!untreatedEvent){
    //     //             mongoDbService.storeEvent("service_panic", {...reading, status:"UNTREATED"});
    //     //         }
    //     //         else{
    //     //             Console.info("untreatedEvent", untreatedEvent);
    //     //         }
    //     //
    //     //         //spawn the same service !!
    //     //         if(serviceDispatcher.checkScalingCondition(_serviceGroup)){
    //     //             Console.debug(_containerName, "should scale up" );
    //     //         }
    //     //
    //     //     }
    //     //
    //     //     mongoDbService.upsertMonitoringEvent(reading);
    //     //
    //     //     _monitorData.readings.push(reading);
    //     //
    //     //     // Check if monitoring duration has elapsed
    //     //     if (_durationMs > 0 && timestamp - _startTime >= _durationMs) {
    //     //         _monitorData.isRunning = false;
    //     //         stopMonitoringContainerCpu(_containerName);
    //     //         Console.log(`CPU monitoring for ${_containerName} completed`);
    //     //         emitter.emit("monitoring-completed", {
    //     //             containerName: _containerName,
    //     //             readings: _monitorData.readings
    //     //         });
    //     //     }
    //     // }
    //
    //     // cpuMonitoringIntervals[containerName] = setIntervalImmediate(
    //     //     async () => {
    //     //         await cpuMonitoringProcedure(
    //     //             containerName,
    //     //             (_panicThreshold || kPanicThreshold),
    //     //             monitorData,
    //     //             startTime,
    //     //             serviceGroup,
    //     //             durationMs
    //     //         );
    //     //     },
    //     //     intervalMs
    //     // );
    //
    //
    //     // Return control object
    //     return {
    //         stop: () => {
    //             monitorData.isRunning = false;
    //             clearInterval(cpuMonitoringIntervals[containerName]);
    //             Console.log(`CPU monitoring for ${containerName} stopped`);
    //             emitter.emit("monitoring-stopped", {
    //                 containerName,
    //                 readings: monitorData.readings
    //             });
    //             return monitorData.readings;
    //         },
    //         getData: () => {
    //             return monitorData.readings;
    //         }
    //     };
    // }

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
    // function monitorContainerPerformance(containerName, durationMs = 60000, intervalMs = 1000) {
    //     return new Promise((resolve) => {
    //         const results = {
    //             cpu: [],
    //             memory: []
    //         };
    //
    //         const cpuMonitor = monitorContainerCpu(
    //             containerName,
    //             intervalMs,
    //             durationMs,
    //             (reading) => {
    //                 results.cpu.push(reading);
    //                 Console.log(`${containerName} CPU: ${reading.cpuPercent.toFixed(2)}%`);
    //             }
    //         );
    //
    //         const memMonitor = monitorContainerMemory(
    //             containerName,
    //             intervalMs,
    //             durationMs,
    //             (reading) => {
    //                 results.memory.push(reading);
    //                 if (reading.memoryUsage) {
    //                     Console.log(`${containerName} Memory: ${reading.memoryUsage.used} / ${reading.memoryUsage.limit} (${reading.memoryUsage.percentage.toFixed(2)}%)`);
    //                 }
    //             }
    //         );
    //
    //         // Resolve after duration
    //         setTimeout(() => {
    //             cpuMonitor.stop();
    //             memMonitor.stop();
    //
    //             // Calculate averages
    //             const avgCpu = results.cpu.reduce((sum, r) => sum + r.cpuPercent, 0) / results.cpu.length;
    //
    //             const avgMemPercent = results.memory
    //                 .filter(r => r.memoryUsage)
    //                 .reduce((sum, r) => sum + r.memoryUsage.percentage, 0) /
    //                 results.memory.filter(r => r.memoryUsage).length;
    //
    //             Console.log(`Average CPU usage: ${avgCpu.toFixed(2)}%`);
    //             Console.log(`Average Memory usage: ${avgMemPercent.toFixed(2)}%`);
    //
    //             resolve({
    //                 containerName,
    //                 duration: durationMs,
    //                 interval: intervalMs,
    //                 readings: results,
    //                 summary: {
    //                     avgCpuPercent: avgCpu,
    //                     avgMemoryPercent: avgMemPercent
    //                 }
    //             });
    //         }, durationMs);
    //     });
    // }

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

    instance.bestCandidateContainer = bestCandidateContainer;

    instance.haveAllContainersSettledInStatus = haveAllContainersSettledInStatus;


    // Expose public methods
    instance.getContainerCpuUsage = getContainerCpuUsage;
    instance.getContainerMemoryUsage = getContainerMemoryUsage;
    instance.checkContainerPerformance = checkContainerPerformance;
    // instance.monitorContainerCpu = monitorContainerCpu;
    instance.monitorContainerMemory = monitorContainerMemory;
    // instance.monitorContainerPerformance = monitorContainerPerformance;

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

