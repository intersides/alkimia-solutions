import { exec, execSync } from "node:child_process";
import { EventEmitter } from "node:events";
import Console from "@intersides/console";

/**
 * Service for monitoring Docker container performance metrics
 */
export default function ContainerMonitorService() {
    const instance = Object.create(ContainerMonitorService.prototype);
    const emitter = new EventEmitter();

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

    /**
     * Monitor container CPU usage at regular intervals
     * @param {string} containerName - Name of the container to monitor
     * @param {number} intervalMs - Monitoring interval in milliseconds
     * @param {number} durationMs - Total monitoring duration in milliseconds (0 for indefinite)
     * @param {function} callback - Callback function(reading)
     * @returns {object} - Monitor control object with stop() method
     */
    function monitorContainerCpu(containerName, intervalMs = 1000, durationMs = 0, callback) {
        Console.log(`Starting CPU monitoring for ${containerName}`);

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
            if (typeof callback === "function") {
                callback(reading);
            }

            // Check if monitoring duration has elapsed
            if (durationMs > 0 && timestamp - startTime >= durationMs) {
                monitorData.isRunning = false;
                clearInterval(intervalId);
                Console.log(`CPU monitoring for ${containerName} completed`);
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
     * @returns {object} - Monitor control object with stop() method
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

            // Call the callback if provided
            if (typeof callback === "function") {
                callback(reading);
            }

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

    return instance;
}

// Singleton pattern
let _instance = null;

ContainerMonitorService.getSingleton = function() {
    if (!_instance) {
        _instance = ContainerMonitorService();
    }
    return _instance;
};

ContainerMonitorService.getInstance = function() {
    return ContainerMonitorService();
};
