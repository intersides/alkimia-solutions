import {sayHello, printServerInfo, parseEnvFile} from "@workspace/common";
import {getSystemInfo} from "@workspace/node";
import CryptoService from "@workspace/common/services/CryptoService.js";
import path from "node:path";
import {fileURLToPath} from "url";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {MimeType} from "@workspace/common/enums.js";
import Console from "@intersides/console";
import {HttpResponse} from "@workspace/node/ServerResponse.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const __projectRoot = path.resolve(__dirname, "../../");
const __appRoot = path.resolve(__dirname, "./");

globalThis.__projectRoot = __projectRoot;
globalThis.__appRoot = __appRoot;

const PORT = process.env.PORT || 3000;
const PUBLIC_PORT = process.env.PUBLIC_PORT || PORT;
const PROTOCOL = process.env.PROTOCOL || "https";
const SUBDOMAIN = process.env.SUBDOMAIN || "";
const DOMAIN = process.env.DOMAIN || "localhost";

const cryptoService = CryptoService.getInstance();

const appInstanceId = cryptoService.generateRandomBytes();

const staticDir = `${globalThis.__appRoot}/static`;

// Function to create CPU load
async function createLoad(targetIntensity, duration) {
    const start = Date.now();
    Console.log(`Starting CPU stress test with smooth ramp-up: target=${targetIntensity}%, duration=${duration}ms`);

    // Calculate ramp-up time (e.g., 1/3 of total duration)
    const rampUpTime = Math.min(duration / 3, 10000); // Max 10 seconds for ramp-up
    const cycleTime = 100; // Total cycle time in ms

    while (Date.now() - start < duration) {
        // Calculate current intensity based on elapsed time
        const elapsed = Date.now() - start;
        let currentIntensity;

        if (elapsed < rampUpTime) {
            // During ramp-up phase, gradually increase intensity
            currentIntensity = (elapsed / rampUpTime) * targetIntensity;
        } else {
            // After ramp-up, maintain target intensity
            currentIntensity = targetIntensity;
        }

        // Calculate work and sleep time for this cycle
        const workTime = Math.floor(cycleTime * (currentIntensity / 100));
        const sleepTime = cycleTime - workTime;

        // Work phase - use CPU intensively
        const workEnd = Date.now() + workTime;
        while (Date.now() < workEnd) {
            // CPU-intensive calculations
            Math.sqrt(Math.random() * 10000);
            Math.sin(Math.random() * 10000);
        }

        // Sleep phase - yield CPU time
        if (sleepTime > 0) {
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }

        // Optionally log progress during ramp-up
        if (elapsed < rampUpTime && elapsed % 1000 < cycleTime) {
            Console.log(`Ramping up: ${currentIntensity.toFixed(1)}% CPU usage`);
        }
    }

    Console.log(`Completed CPU stress test: target=${targetIntensity}%, duration=${duration}ms`);
    return {
        intensity: targetIntensity,
        duration,
        completed: true
    };
}


Server.getInstance({
    port: PORT,
    publicAddress: `${PROTOCOL}://${!!SUBDOMAIN ? SUBDOMAIN + "." : ""}${DOMAIN}:${PUBLIC_PORT}`,
    router: Router.getInstance({
        staticDir,
        // sharedDir,
        // modulesDir,
        routes: {
            "*":{
                handler: (req) => {
                    Console.info("incoming:", req.url, "\n\t\twith payload", req.body);
                }
            },
            POST: {
                "/api/setCounter": {
                    isProtected: false,
                    handler: async (req) => {
                        return HttpResponse({
                            data: {
                                message: "Incremented counter",
                                value: req.body.counter.value++,
                                serverTime: new Date().toISOString()
                            },
                            mimeType: MimeType.JSON
                        });
                    }
                }
            },
            GET: {
                "/hello": {
                    isProtected: false,
                    handler: () => HttpResponse({
                        data: {msg: "hello"},
                        mimeType:MimeType.JSON
                    })
                },
                "/api/stress/incremental": {
                    isProtected: false,
                    handler: (req) => {

                        Console.debug("DEBUG: req.url", req.url);

                        const steps = parseInt(req.url.query.steps || "5", 10);
                        const maxIntensity = parseInt(req.url.query.maxIntensity || "50", 10);
                        const stepDuration = parseInt(req.url.query.stepDuration || "10000", 10);

                        // Limit values
                        const safeSteps = Math.min(Math.max(steps, 1), 20);
                        const safeMaxIntensity = Math.min(Math.max(maxIntensity, 1), 100);
                        const safeStepDuration = Math.min(Math.max(stepDuration, 1000), 30000);

                        // Schedule increasing load steps
                        for(let i = 1; i <= safeSteps; i++){
                            const intensity = (i / safeSteps) * safeMaxIntensity;
                            setTimeout(() => {
                                Console.log(`Starting step ${i}/${safeSteps} with intensity ${intensity.toFixed(2)}`);
                                createLoad(intensity, safeStepDuration);
                            }, (i - 1) * safeStepDuration);
                        }

                        return HttpResponse({
                            data:{
                                message: "Incremental CPU stress test started",
                                steps: safeSteps,
                                maxIntensity: safeMaxIntensity,
                                stepDuration: safeStepDuration,
                                totalDuration: safeSteps * safeStepDuration,
                                serverTime: new Date().toISOString()
                            },
                            mimeType: MimeType.JSON
                        });

                    }
                },
                "/api/stress": {
                    isProtected: false,
                    handler: (req) => {
                        Console.debug("DEBUG: req.url", req.url);

                        // Get parameters from query string with defaults

                        const intensity = parseInt(req.url.query.intensity || "1", 10);
                        const duration = parseInt(req.url.query.duration || "5000", 10);

                        // Limit values to prevent a server crash
                        const safeIntensity = Math.min(Math.max(intensity, 1), 100);
                        const safeDuration = Math.min(Math.max(duration, 1000), 60000);

                        // Run the load in the background
                        setTimeout(() => {
                            createLoad(safeIntensity, safeDuration);
                        }, 0);

                        return HttpResponse({
                            data:{
                                message: "CPU stress test started",
                                intensity: safeIntensity,
                                duration: safeDuration,
                                serverTime: new Date().toISOString()
                            },
                            mimeType: MimeType.JSON
                        });

                    }
                },
                "/": {
                    isProtected: false,
                    handler: () => {
                        printServerInfo(process.env.PROTOCOL, process.env.SUBDOMAIN + "." + process.env.DOMAIN, null, process.env.ENV);

                        return HttpResponse({
                            data: {
                                system: getSystemInfo()
                            },
                            mimeType:MimeType.JSON
                        } );
                    }
                }
            },
            default:{
                handler: () => HttpResponse({
                    data: {
                        msg: "hello"
                    },
                    mimeType: MimeType.JSON
                })
            }

        }
    })
});
