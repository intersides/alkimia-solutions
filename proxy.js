import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";
import DockerManager from "./DockerManager.js";
import {parseEnvFile} from "@workspace/common";
import Console from "@intersides/console";
import { WebSocketServer } from "ws";
import * as net from "node:net";
import mqtt from "mqtt";
import manifest from "./services-manifest.js";
import ServiceDispatcher from "./modules/ServiceDispatcher.js";
import ContainerMonitorService from "./modules/ContainerMonitorService.js";
import {HttpErrorStatus} from "@workspace/common/enums.js";

const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

const keyPath = path.join(_projectRootPath, "./certs/key.pem");
const certPath = path.join(_projectRootPath, "./certs/fullchain.pem");

const key = fs.readFileSync(keyPath, {encoding: "utf-8"});
const cert = fs.readFileSync(certPath, {encoding: "utf-8"});

let envContent = fs.readFileSync(`${_projectRootPath}/.env`, {encoding:"utf-8"});
let envVars = parseEnvFile(envContent);
Console.log("environment variables:", envVars);

let containerMonitorService = ContainerMonitorService({});

let serviceDispatcher = ServiceDispatcher({
    manifest
});

let  mqttClient = null;
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

    mqttClient.subscribe("services/network", (err) => {
        if (err) {
            console.error("[PROXY] MQTT Subscribe error:", err.message);
        } else {
            console.log("[PROXY] MQTT Subscribed to test/ping");
        }
    });

    setTimeout(()=>{
        mqttClient.publish("test/ping", "hello from proxy", {qos:2});
    }, 5000);

});

mqttClient.on("message", (topic, message) => {
    Console.warn("[PROXY] MQTT message:", topic, message.toString());
    if(topic === "services/network"){
        const topicMessage = JSON.parse(message.toString());
        Console.debug("[PROXY] MQTT topicMessage:", topic, topicMessage);
    }
});
mqttClient.on("error", (err) => {
    Console.error("[PROXY] MQTT connection error", err);
});

let dockerManager = DockerManager.getInstance({
    root:_projectRootPath,
    envVars
});
dockerManager.on("container-started", function(containerInfo){
    Console.info(`onEvent Container ${containerInfo.name} has started`);

});
dockerManager.on("running", function(containerInfo){

    Console.info(`onEvent Container ${containerInfo.name} running`);

    if(containerInfo.name === "alkimia-backend"){

        containerMonitorService.monitorContainerCpu(containerInfo.name, 2000, 0, (reading)=>{
            Console.info("monitoring reading:", reading);
            if(reading.panic){
                Console.warn("PANIC in ", containerInfo.name);
            }
        });
    }

});
dockerManager.on("stopped", function(containerInfo){
    Console.warn(`onEvent Container ${containerInfo.name} stopped`);
});
dockerManager.on("error", function(containerInfo){
    Console.error(`onEvent Container ${containerInfo.name} error`);
});
dockerManager.on("not_exists", function(containerInfo){
    Console.error(`onEvent Container not_exists ${containerInfo.name}`);
});


// HTTPS proxy (port 443) with SSL termination
const sslOptions = {
    key,
    cert
};

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

    });

    // Forward the request body
    req.pipe(proxyReq);

    // Handle errors
    proxyReq.on("error", (err) => {
        Console.error("Proxy request error:", err);
        if(!res.headersSent){
            res.writeHead(HttpErrorStatus.Http502_Bad_Gateway.status);
            res.end(HttpErrorStatus.Http502_Bad_Gateway.statusText);
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
    const httpRoute = serviceDispatcher.httpRouting.find(rule => rule.match(req));
    if(httpRoute){

        Console.debug("httpRoute:", httpRoute);
        Console.debug("target:", httpRoute.target);

        dockerManager.checkContainerRunning(httpRoute.target.config.container_name).then((isRunning) => {
            Console.debug("service:", httpRoute.target.config.container_name, "is running:", isRunning);
            if(!isRunning){

                Console.debug(`location: target.location:${httpRoute.target.location}`);

                dockerManager.manageContainer({
                    name: httpRoute.target.name,
                    container_name: httpRoute.target.config.container_name,
                    subdomain: httpRoute.target.config.subdomain,
                    location: httpRoute.target.location,
                    port: httpRoute.target.port,
                    networkName:"alkimia-net",
                    forceRestart:false
                });

                dockerManager.waitForContainerReady(httpRoute.target.config.container_name).then(() => {
                    Console.debug(`container ${httpRoute.target.config.container_name} is now running`);

                    dockerManager.waitUntilContainerIsHealthy(httpRoute.target.config.container_name).then((isHealthy)=>{
                        if(isHealthy){
                            Console.debug(`container ${httpRoute.target.config.container_name} is now ready`);
                            proxyRequest(httpRoute.target, req, res);
                        }
                        else{

                            if (!res.headersSent) {
                                res.writeHead(HttpErrorStatus.Http502_Bad_Gateway.status);
                                res.end(HttpErrorStatus.Http502_Bad_Gateway.statusText);
                            }

                        }
                    }).catch(err=>{
                        Console.error(err);

                        if (!res.headersSent) {
                            res.writeHead(HttpErrorStatus.Http502_Bad_Gateway.status);
                            res.end(HttpErrorStatus.Http502_Bad_Gateway.statusText);
                        }

                    });

                }).catch(err => {
                    Console.error(err);

                    if (!res.headersSent) {
                        res.writeHead(HttpErrorStatus.Http502_Bad_Gateway.status);
                        res.end(HttpErrorStatus.Http502_Bad_Gateway.statusText);
                    }

                });

            }
            else{
                Console.debug("forwarding request :", req.url, "to service:", httpRoute.target.config.container_name);
                proxyRequest(httpRoute.target, req, res);
            }

        }).catch(err => {
            Console.error(err);
            // NOTE: Handle error response to client
            if (!res.headersSent) {
                res.writeHead(HttpErrorStatus.Http500_Internal_Server_Error.status);
                res.end(HttpErrorStatus.Http500_Internal_Server_Error.statusText);
            }
        });

    }
    else{
        if (!res.headersSent) {
            res.writeHead(HttpErrorStatus.Http404_Not_Found.status);
            res.end(HttpErrorStatus.Http404_Not_Found.statusText);
        }
    }



});

httpsServer.on("upgrade", (req, socket, head) => {
    Console.log(`Upgrade request for ${req.headers.host}${req.url}`);
    Console.log("REQ URL:", req.url);
    Console.log("REQ HEADERS:", req.headers);

    const wsRoute = serviceDispatcher.wssRouting.find(rule => rule.match(req));
    if(wsRoute){
        Console.log("wsRoute:", wsRoute);

        const upstream = net.connect(wsRoute.target.port, wsRoute.target.host, () => {

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

    }
    else{
        Console.warn("No valid WS target. Falling back or rejecting.");
        socket.destroy();
    }
    // const target = route?.target;


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

    }),

    new Promise((resolve, reject)=>{

        let serviceName = "alkimia-load-balancer";

        // Start or ensure MQTT broker is running
        try{
            dockerManager.checkContainerRunning(serviceName).then((isRunning) => {
                Console.debug("service:", serviceName, "is running:", isRunning);
                if(!isRunning){

                    dockerManager.manageContainer({
                        name: "load-balancer",
                        container_name: serviceName,
                        subdomain: "balancer",
                        location: "services/LoadBalancer",
                        port: 7001,
                        networkName:"alkimia-net",
                        forceRestart:false
                    });

                    dockerManager.waitForContainerReady(serviceName).then(() => {
                        Console.debug(`container ${serviceName} is now running`);

                        dockerManager.waitUntilContainerIsHealthy(serviceName).then((isHealthy)=>{
                            if(isHealthy){
                                Console.debug(`container ${serviceName} is now ready`);
                                resolve(`Container ${serviceName} is now running`);
                            }
                            else{
                                Console.error(`container ${serviceName} didn't got into ready state`);
                                reject(`container ${serviceName} didn't got into ready state`);
                            }
                        }).catch(err=>{
                            Console.error(err);
                            reject(`container ${serviceName} exception: ${err.message}`);
                        });

                    }).catch(err => {
                        Console.error(err);
                        reject(`container ${serviceName} exception: ${err.message}`);
                    });

                }
                else{
                    resolve(`Service: ${serviceName} is already running`);
                    resolve(serviceName);

                }

            }).catch(err => {
                Console.error(err);
                reject(`container ${serviceName} exception: ${err.message}`);

            });
        }catch (err) {
            Console.error(err.message);
            reject(`Failed to start ${serviceName}: ${err.message}`);
            reject(`container ${serviceName} exception: ${err.message}`);
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


