import {sayHello, printServerInfo, parseEnvFile} from "@workspace/common";
import {getSystemInfo} from "@workspace/node";
import CryptoService from "@workspace/common/services/CryptoService.js";
import path from "node:path";
import {fileURLToPath} from "url";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpResponse} from "@workspace/node/httpLib.js";
import {MimeType} from "@workspace/common/enums.js";
import Console from "@intersides/console";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const __projectRoot = path.resolve(__dirname, "../../");
const __appRoot = path.resolve(__dirname, "./");

globalThis.__projectRoot = __projectRoot;
globalThis.__appRoot = __appRoot;

Console.debug("DEBUG: PORT", process.env.PORT);
Console.debug("DEBUG: PUBLIC_PORT", process.env.PUBLIC_PORT);
Console.debug("DEBUG: PUBLIC_PORT", process.env.PUBLIC_PORT);


const PORT = process.env.PORT || 3000;
const PUBLIC_PORT = process.env.PUBLIC_PORT || PORT;
const PROTOCOL = process.env.PROTOCOL || "https";
const SUBDOMAIN = process.env.SUBDOMAIN || "";
const DOMAIN = process.env.DOMAIN || "localhost";

const cryptoService = CryptoService.getInstance();

const appInstanceId = cryptoService.generateRandomBytes();

const staticDir = `${globalThis.__appRoot}/static`;

// Function to create CPU load
function createLoad(intensity, duration){
    const start = Date.now();
    Console.log(`Starting CPU stress test: intensity=${intensity}, duration=${duration}ms`);

    // Create CPU load by performing calculations
    while(Date.now() - start < duration){
        // The higher the intensity, the more calculations we do in each iteration
        for(let i = 0; i < intensity * 1000; i++){
            Math.sqrt(Math.random() * 10000);
            Math.sin(Math.random() * 10000);
            Math.cos(Math.random() * 10000);
            Math.tan(Math.random() * 10000);
        }
    }

    Console.log(`Completed CPU stress test: intensity=${intensity}, duration=${duration}ms`);
    return {
        intensity,
        duration,
        completed: true
    };
}

Server.getInstance({
    port: PORT,
    publicAddress: `${PROTOCOL}://${!!SUBDOMAIN ? SUBDOMAIN+"." : ""}${DOMAIN}:${PUBLIC_PORT}`,
    router: Router.getInstance({
        staticDir,
        // sharedDir,
        // modulesDir,
        routes: {
            // default:{
            //     handler: () => HttpResponse({msg: "hello"}, MimeType.JSON)
            // },
            POST:{
                "/api/setCounter":{
                    isProtected: false,
                    handler: (req)=>{
                        Console.debug("DEBUG: req:", req);

                        return HttpResponse({
                            message: "Incremented counter",
                            value:0,
                            serverTime: new Date().toISOString()
                        }, MimeType.JSON);
                    }
                }
            },
            GET: {
                "/hello": {
                    isProtected: false,
                    handler: () => HttpResponse({msg: "hello"}, MimeType.JSON)
                },
                "/api/stress/incremental":{
                    isProtected: false,
                    handler: (req)=>{

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
                            message: "Incremental CPU stress test started",
                            steps: safeSteps,
                            maxIntensity: safeMaxIntensity,
                            stepDuration: safeStepDuration,
                            totalDuration: safeSteps * safeStepDuration,
                            serverTime: new Date().toISOString()
                        }, MimeType.JSON);

                    }
                },
                "/api/stress":{
                    isProtected: false,
                    handler: (req)=>{
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
                            message: "CPU stress test started",
                            intensity: safeIntensity,
                            duration: safeDuration,
                            serverTime: new Date().toISOString()
                        }, MimeType.JSON);

                    }
                },
                "/": {
                    isProtected: false,
                    handler: () => {
                        printServerInfo(process.env.PROTOCOL, process.env.SUBDOMAIN+"."+process.env.DOMAIN, null, process.env.ENV);

                        return HttpResponse({system:getSystemInfo()}, MimeType.JSON);
                    }
                }
            }
        }
    })
});
