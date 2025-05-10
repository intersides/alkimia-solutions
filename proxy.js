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
import {HttpErrorStatus} from "@workspace/common/enums.js";

const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

const keyPath = path.join(_projectRootPath, "./certs/key.pem");
const certPath = path.join(_projectRootPath, "./certs/fullchain.pem");

const key = fs.readFileSync(keyPath, {encoding: "utf-8"});
const cert = fs.readFileSync(certPath, {encoding: "utf-8"});

let envContent = fs.readFileSync(`${_projectRootPath}/.env`, {encoding:"utf-8"});
let envVars = parseEnvFile(envContent);
Console.log("environment variables:", envVars);

let serviceDispatcher = ServiceDispatcher({
    manifest
});

let  mqttClient = null;

let dockerManager = DockerManager.getInstance({
    root:_projectRootPath,
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

            setTimeout(()=>{
                mqttClient.publish("test/ping", "hello from proxy", {qos:2});
            }, 5000);

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

    let requestHost = req.headers.host;

    // Determine the target server based on routing rules
    // const route = serviceDispatcher.routingRules.find(rule => rule.match(req));
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
                    proxyRequest(httpRoute.target, req, res);
                }).catch(err => {
                    Console.error(err);

                    if (!res.headersSent) {
                        res.writeHead(HttpErrorStatus.Http502_Bad_Gateway.status);
                        res.end(HttpErrorStatus.Http502_Bad_Gateway.statusText);
                    }

                });

                // dockerService.waitForContainerReady(httpRoute.target.config.container_name).then(() => {
                //     Console.debug(`container ${httpRoute.target.config.container_name} is now running`);
                //
                //     proxyRequest(target, req, res);
                //
                // }).catch(err => {
                //     Console.error(err);
                // });

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

    })
]).then(resolved=>{
    Console.info(resolved);

    httpsServer.listen(443, () => {
        Console.log("HTTPS proxy server listening on port 443");
    });

}).catch(failures=>{
    Console.error("Failed to start proxy, one or more services didn't start", failures);
});


