import http from "http";
import { sayHello, printServerInfo } from "@workspace/common";
import { getSystemInfo } from "@workspace/node";
import CryptoService from "@workspace/common/services/CryptoService.js"
import fs from "node:fs";

const PORT = 3000;

const cryptoService = CryptoService.getInstance();

const appInstanceId = cryptoService.generateRandomBytes();

let index = 0;
const server = http.createServer((req, res) => {

    console.log("**requesting:", req.url, );

    res.writeHead(200, { "Content-Type": "application/json" });

    if(req.url === "/api/hello"){
        res.end(JSON.stringify({msg:"world"}));
    }
    else if(req.url.startsWith("/api/stress")){

        let queryPart = req.url.split("?")[1];
        let params = queryPart.split("&");
        let query = {}
        params.forEach(entry=>{
            let parts = entry.split("=");
            query[parts[0]] = parts[1];
        });

        // Get parameters from query string with defaults
        console.log("!!",query);

        const intensity = parseInt(query.intensity || '1', 10);
        const duration = parseInt(query.duration || '5000', 10);

        // Limit values to prevent server crash
        const safeIntensity = Math.min(Math.max(intensity, 1), 100);
        const safeDuration = Math.min(Math.max(duration, 1000), 60000);

        // Run the load in the background
        setTimeout(() => {
            createLoad(safeIntensity, safeDuration);
        }, 0);

        res.end(JSON.stringify({
            message: 'CPU stress test started',
            intensity: safeIntensity,
            duration: safeDuration,
            serverTime: new Date().toISOString()
        }));

    }
    else if(req.url === "/api/stress/incremental"){
        const steps = parseInt(req.query.steps || '5', 10);
        const maxIntensity = parseInt(req.query.maxIntensity || '50', 10);
        const stepDuration = parseInt(req.query.stepDuration || '10000', 10);

        // Limit values
        const safeSteps = Math.min(Math.max(steps, 1), 20);
        const safeMaxIntensity = Math.min(Math.max(maxIntensity, 1), 100);
        const safeStepDuration = Math.min(Math.max(stepDuration, 1000), 30000);

        // Schedule increasing load steps
        for (let i = 1; i <= safeSteps; i++) {
            const intensity = (i / safeSteps) * safeMaxIntensity;
            setTimeout(() => {
                console.log(`Starting step ${i}/${safeSteps} with intensity ${intensity.toFixed(2)}`);
                createLoad(intensity, safeStepDuration);
            }, (i - 1) * safeStepDuration);
        }

        res.end(JSON.stringify(
            {
                message: 'Incremental CPU stress test started',
                steps: safeSteps,
                maxIntensity: safeMaxIntensity,
                stepDuration: safeStepDuration,
                totalDuration: safeSteps * safeStepDuration,
                serverTime: new Date().toISOString()
            }

        ));
    }
    else if(req.url === "/api/setCounter"){

        return res.end(JSON.stringify({value:0}));
    }
    else{
        res.end(JSON.stringify({
            message: sayHello(" My Proxied Backend Server"),
            system: getSystemInfo(),
            appInstanceId
        }));
    }


});

server.listen(PORT, () => {
    console.debug("****");
    printServerInfo(process.env.PROTOCOL, process.env.SUBDOMAIN+"."+process.env.DOMAIN, null, process.env.ENV);
    console.log("system info: ", getSystemInfo());
});



// Function to create CPU load
function createLoad(intensity, duration) {
    const start = Date.now();
    console.log(`Starting CPU stress test: intensity=${intensity}, duration=${duration}ms`);

    // Create CPU load by performing calculations
    while (Date.now() - start < duration) {
        // The higher the intensity, the more calculations we do in each iteration
        for (let i = 0; i < intensity * 1000; i++) {
            Math.sqrt(Math.random() * 10000);
            Math.sin(Math.random() * 10000);
            Math.cos(Math.random() * 10000);
            Math.tan(Math.random() * 10000);
        }
    }

    console.log(`Completed CPU stress test: intensity=${intensity}, duration=${duration}ms`);
    return { intensity, duration, completed: true };
}
