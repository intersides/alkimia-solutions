import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";
// import DockerService from "./DockerService.js";
import DockerManager from "./modules/DockerManager.js";
import {parseEnvFile} from "@workspace/common";
import Console from "@intersides/console";
import { WebSocketServer } from "ws";
import * as net from "node:net";
import mqtt from "mqtt";
import manifest from "./services-manifest.js";

const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

const keyPath = path.join(_projectRootPath, "./certs/key.pem");
const certPath = path.join(_projectRootPath, "./certs/fullchain.pem");

const key = fs.readFileSync(keyPath, {encoding: "utf-8"});
const cert = fs.readFileSync(certPath, {encoding: "utf-8"});

let envContent = fs.readFileSync(`${_projectRootPath}/.env`, {encoding:"utf-8"});
let envVars = parseEnvFile(envContent);
Console.log("environment variables:", envVars);

// let dockerService = DockerService.getInstance({
//     envVars
// });

let dockerManager = DockerManager.getInstance({
    envVars
});
dockerManager.on("container-started", function(params){
    Console.info(`onEvent Container ${params.name} has started`);
});
dockerManager.on("running", function(params){
    Console.info(`onEvent Container ${params.name} running`);
    if(params.name === "mqtt-alkimia-broker"){

        mqttClient = mqtt.connect("mqtt://mqtt.alkimia.localhost/");
        mqttClient.on("connect", () => {
            Console.debug("[PROXY] MQTT connected");

            mqttClient.subscribe("test/ping", (err) => {
                if (err) {
                    console.error("[PROXY] MQTT Subscribe error:", err.message);
                } else {
                    console.log("[PROXY] MQTT Subscribed to test/ping");
                }
            });

            setInterval(()=>{
                Console.debug("info: about to publish on test/ping channel from proxy");
                mqttClient.publish("test/ping", "hello from proxy");
            }, 3000);

        });

        mqttClient.on("message", (topic, message) => {
            Console.debug("[PROXY] MQTT message:", topic, message.toString());
        });
        mqttClient.on("error", (err) => {
            Console.error("[PROXY] MQTT connection error", err);
        });
    }
});
dockerManager.on("stopped", function(params){
    Console.warn(`onEvent Container ${params.name} stopped`);
});
dockerManager.on("error", function(params){
    Console.error(`onEvent Container ${params.name} error`);
});
dockerManager.on("not_exists", function(params){
    Console.error(`onEvent Container not_exists ${params.name}`);
});


let  mqttClient = null;


// HTTPS proxy (port 443) with SSL termination
const sslOptions = {
    key,
    cert
};

// Define routing rules
const routingRules = [
    {
        // Route based on path
        match: (req) => req.url.startsWith("/api/"),
        target: {
            type:"app",
            service: "alkimia-backend",
            name: "backend",
            host: "localhost",
            port: 8080
        }
    },
    {
        // Route based on hostname
        match: (req) => req.headers.host === "app.alkimia.localhost",
        target: {
            type:"app",
            service: "alkimia-frontend",
            name: "frontend",
            host: "localhost",
            port: 7070
        }
    },
    {
        // Route based on hostname
        match: (req) => req.headers.host === "server.alkimia.localhost",
        target: {
            type:"app",
            service: "alkimia-backend",
            name: "backend",
            host: "localhost",
            port: 8080
        }
    },
    {
        // Route based on hostname
        match: (req) => req.headers.host === "mqtt.alkimia.localhost",
        target: {
            type:"service",
            service: "mqtt-alkimia-broker",
            name: "mqtt",
            host: "localhost",
            port: 9001
        }
    }

    // {
    //     // Route based on HTTP method
    //     match: (req) => req.method === 'POST',
    //     target: { host: 'localhost', port: 7071 }
    // },
    // {
    //     // Default route
    //     match: () => true,
    //     target: { host: 'localhost', port: 7070 }
    // }
];

function proxyRequest(target, req, res){
    Console.log(`Routing to: ${target.host}:${target.port}`);

    const proxyReq = http.request({
        host: target.host,
        port: target.port,
        path: req.url,
        method: req.method,
        headers: req.headers,
        agent: false  // Disable keep-alive
    }, (proxyRes) => {
        // Forward the response status and headers
        Console.log("forwarding..." );
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Pipe the response data
        proxyRes.pipe(res);

        if(mqttClient){
            Console.debug("MQTT publishing on test/ping");
            mqttClient.publish("test/ping", "hello from proxy");
        }

    });

    // Forward the request body
    req.pipe(proxyReq);

    // Handle errors
    proxyReq.on("error", (err) => {
        Console.error("Proxy request error:", err);
        if(!res.headersSent){
            res.writeHead(502);
            res.end("Bad Gateway");
        }
        else{
            res.end();
        }
    });
}

const httpsServer = https.createServer(sslOptions, function(req, res){
    // Log the incoming request
    Console.log(`Received request: ${req.method} ${req.url}`);
    Console.log(`Host header: ${req.headers.host}`);

    // Determine the target server based on routing rules
    const route = routingRules.find(rule => rule.match(req));

    console.debug("DEBUG: route->", route);

    const target = route?.target || {
        service: "alkimia-backend",
        name: "backend",
        host: "localhost",
        port: 8080
    };

    Console.debug("target:", target);

    dockerManager.checkContainerRunning(target.service).then((isRunning) => {
        Console.debug("service:", target.service, "is running:", isRunning);
        if(!isRunning){
            // Use the improved manageContainer method which handles all container states
            dockerManager.manageContainer({
                name: target.service,
                service: target.name,
                port: target.port
            });

            dockerManager.waitForContainerReady(target.service).then(() => {
                Console.debug(`container ${target.service} is now running`);
                proxyRequest(target, req, res);
            }).catch(err => {
                Console.error(err);

                // NOTE: Handle error response to client
                if (!res.headersSent) {
                    res.writeHead(502);
                    res.end("Bad Gateway - Container failed to start");
                }

            });

            // dockerService.waitForContainerReady(target.service).then(() => {
            //     Console.debug(`container ${target.service} is now running`);
            //
            //     proxyRequest(target, req, res);
            //
            // }).catch(err => {
            //     Console.error(err);
            // });

        }
        else{
            Console.debug("forwarding request :", req.url, "to service:", target.service);
            proxyRequest(target, req, res);
        }

    }).catch(err => {
        Console.error(err);
        // NOTE: Handle error response to client
        if (!res.headersSent) {
            res.writeHead(500);
            res.end("Internal Server Error");
        }
    });



});





httpsServer.on("upgrade", (req, socket, head) => {
    Console.log(`Upgrade request for ${req.headers.host}${req.url}`);
    Console.log("REQ URL:", req.url);
    Console.log("REQ HEADERS:", req.headers);

    const route = routingRules.find(rule => rule.match(req));
    const target = route?.target;

    Console.log("target:", target);

    if (!target || !target.port || !target.host) {
        Console.warn("No valid WS target. Falling back or rejecting.");
        socket.destroy();
        return;
    }

    const upstream = net.connect(target.port, target.host, () => {

        // Proper HTTP upgrade framing
        const requestLine = `GET ${req.url} HTTP/1.1\r\n`;
        const headers = Object.entries(req.headers)
            .map(([key, val]) => `${key}: ${val}`)
            .join("\r\n") + "\r\n\r\n";

        upstream.write(requestLine + headers);
        upstream.write(head);

        socket.setNoDelay(true);
        upstream.setNoDelay(true);

        upstream.pipe(socket);
        socket.pipe(upstream);
    });

    upstream.on("error", err => {
        Console.error("WS Proxy Error:", err);
        socket.destroy();
    });

    socket.on("error", err => {
        Console.error("Client WS Error:", err);
        upstream.destroy();
    });
});


// const wss = new WebSocketServer({ server: httpsServer });
// wss.on("connection", (ws, req) => {
//     Console.log("WebSocket connection established", req);
//
//     ws.on("error", Console.error);
//
//     ws.on("message", function message(data) {
//         Console.log("received: %s", data);
//         ws.send("hello from server");
//     });
//
// });



//spin up additional services and brokers such as MQTT Mosquito.
Promise.all([

    new Promise((resolve, reject)=>{

        let mqttBrokerName = "mqtt-alkimia-broker";

        // Start or ensure MQTT broker is running
        try{
            const result = dockerManager.startMosquittoBroker(mqttBrokerName);
            Console.debug(`MQTT broker operation result:${result}`);

            if(result === "alredy_running"){
                resolve(`Service: ${mqttBrokerName} is already running`);
            }
            else{
                // For both "started_existing" and "created_new" cases, wait for readiness
                dockerManager.waitForContainerReady(mqttBrokerName)
                    .then(() => {
                        resolve(`Container ${mqttBrokerName} is now running`);
                    })
                    .catch(err => {
                        Console.error(err.message);
                        reject(`Failed waiting for ${mqttBrokerName}`);
                    });
            }
        }catch (err) {
            Console.error(err.message);
            reject(`Failed to start ${mqttBrokerName}: ${err.message}`);
        }

    })
]).then(resolved=>{
    Console.info(resolved);

    httpsServer.listen(443, () => {
        Console.log("HTTPS proxy server listening on port 443");
    });

}).catch(failures=>{
    Console.error("Failed to start proxy, one or more services didn't start", failures);
});


