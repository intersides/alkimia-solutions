import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";
import DockerManager from "./DockerManager.js";
import Console from "@intersides/console";
import { DateTime } from "luxon";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import * as net from "node:net";
import ServiceDispatcher from "./modules/ServiceDispatcher.js";
import ContainerMonitorService from "./modules/ContainerMonitorService.js";
import {HttpErrorStatus, MimeType} from "@workspace/common/enums.js";
import MqttService from "./modules/MqttService.js";
import MongoDbService from "./modules/MongoDbService.js";
import Manifest from "./services-manifest.js";
import {setIntervalImmediate} from "@workspace/common/utils.js";
import {HttpResponse} from "@workspace/node/ServerResponse.js";
import ProxyRouter from "./ProxyRouter.js";
import CryptoService from "@workspace/common/services/CryptoService.js";

dotenv.config();

const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

const manifest = Manifest({
    root:_projectRootPath
});
const keyPath = path.join(_projectRootPath, "./certs/key.pem");
const certPath = path.join(_projectRootPath, "./certs/fullchain.pem");

const key = fs.readFileSync(keyPath, {encoding: "utf-8"});
const cert = fs.readFileSync(certPath, {encoding: "utf-8"});

Console.info("environment variables:", process.env);

let mongoDbService = MongoDbService({
    uri: process.env.MONGO_DB_URI,
    dbName: process.env.MONGO_DB_NAME
});

//TODO: try to get rid of envVars
let dockerManager = DockerManager.getInstance({
    root:_projectRootPath,
    envVars:process.env,
    manifest
});

let serviceDispatcher = ServiceDispatcher({
    manifest,
    dockerManager
});

let containerMonitorService = ContainerMonitorService({
    mongoDbService,
    dockerManager,
    serviceDispatcher
});

// HTTPS proxy (port 443) with SSL termination
const sslOptions = {
    key,
    cert
};

function monitorRunningContainers(){
    //clear services entries if containers do not exist

    mongoDbService.removeAllServices().then(()=>{
        let allContainers = dockerManager.getContainersByFilter("alkimia-workspace", "namespace");
        allContainers.forEach(container=>{
            let info =  {
                container_id:container["ID"],
                name:container["Names"],
                port:dockerManager.extractExternalPort(container["Ports"]),
                state:container["State"],
                status:container["Status"],
                createdAt: dockerManager.convertContainerInfoDateIntoIsoDate(container["CreatedAt"]),
                updatedAt:new Date()
            };
            mongoDbService.upsertService(info);
        });
    });

}


function proxyRequest(serviceManifest, req, res){
    Console.log("Routing to:", serviceManifest);

    //NOTE: here is where the best candidate is determined.
    let container = containerMonitorService.bestCandidateContainer(serviceManifest);
    if(!container){
        Console.error("container not found !!");
        res.writeHead(HttpErrorStatus.Http404_Not_Found.status);
        res.end(HttpErrorStatus.Http404_Not_Found.statusText);
        return;
    }

    let externalPort = dockerManager.extractExternalPort(container?.["Ports"]);
    if(!externalPort){
        Console.error("failed to retrieve port from container");
        res.writeHead(HttpErrorStatus.Http500_Internal_Server_Error.status);
        res.end(HttpErrorStatus.Http500_Internal_Server_Error.statusText);
        return;
    }

    req.on("close", ()=>((_container)=>{
        Console.debug("request completed on container:", _container["Names"]);
    })(container));

    //used to identify the request when calculating latency
    let requestId = CryptoService.getSingleton().generateRandomBytes();

    const proxyReq = http.request({
        host: serviceManifest.config.host,
        port: externalPort,
        path: req.url,
        method: req.method,
        headers: {...req.headers,  request_id:requestId },
        agent: false  // Disable keep-alive
    }, (proxyRes) => {
        // Forward the response status and headers
        Console.log(`forwarding to... ${serviceManifest.config.host}:${externalPort} is completed`);

        // Console.debug("proxyRes.request_id", proxyRes._httpMessage.getHeader("request_id"));
        let headerRequestId = proxyRes.req.getHeader("request_id");

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        // Pipe the response data
        proxyRes.pipe(res);
        containerMonitorService.storeLatency(req, externalPort, headerRequestId);
        Console.info("response sent");
    });

    proxyReq.on("finish", ()=>((_container)=>{
        Console.debug("proxy performed on container:", _container["Names"]);
    })(container));

    // Handle errors
    proxyReq.on("error", (err)=>((_err, _container)=>{
        {
            Console.error("Proxy request error:", err, "related to container", _container);
            if(!res.headersSent){
                res.writeHead(HttpErrorStatus.Http502_Bad_Gateway.status);
                res.end(HttpErrorStatus.Http502_Bad_Gateway.statusText);
            }
            else{
                res.end();
            }
        }
    })(err, container));

    // Finally, forward the request body
    containerMonitorService.storeLatency(req, externalPort, requestId);

    req.pipe(proxyReq);

}

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws, incomingMessage) => {
    Console.log("WebSocketServer connection established");
    let connectionId = incomingMessage.headers["sec-websocket-key"];
    Console.debug("connectionId", connectionId);
    ws.send(JSON.stringify({
        data:{
            msg:"hello from proxy"
        },
        connectionId
    }));

    ws.on("error", function(error){
        Console.error(error);
    });

    ws.on("message", function message(data) {
        Console.log("received: %s", data);
        // ws.send(JSON.stringify({
        //     data:{
        //         msg:"hello from proxy"
        //     },
        //     connectionId
        // }));
    });

});



const httpsServer = https.createServer(sslOptions, function(req, res){
    // Log the incoming request
    Console.log(`Received request: ${req.method} ${req.url}`);
    Console.log(`Host header: ${req.headers.host}`);

    if(req.url.startsWith("/proxy/")){
        let proxyHttpRouteResponse = ProxyRouter({
            dockerManager
        }).handle(req.url);
        if(proxyHttpRouteResponse){
            proxyHttpRouteResponse.send(res);
        }
        else{
            if (!res.headersSent) {
                res.writeHead(HttpErrorStatus.Http404_Not_Found.status);
                res.end(HttpErrorStatus.Http404_Not_Found.statusText);
            }
        }
    }
    else{
        //Determine the target server based on the req
        const manifestService = serviceDispatcher.getServiceFromRequest(req);
        if (manifestService) {
            // Console.debug("Found service in manifest:", manifestService);
            // Delegate to ContainerMonitorService
            containerMonitorService.ensureServiceAvailable(manifestService, {
                ENV: process.env.ENV
            }).then(()=>{
                proxyRequest(manifestService, req, res);
            }).catch(error=>{
                Console.error("Error handling service request:", error.message);
                if (!res.headersSent) {
                    res.writeHead(HttpErrorStatus.Http500_Internal_Server_Error.status);
                    res.end(HttpErrorStatus.Http500_Internal_Server_Error.statusText);
                }
            });

        } else {
            if (!res.headersSent) {
                res.writeHead(HttpErrorStatus.Http404_Not_Found.status);
                res.end(HttpErrorStatus.Http404_Not_Found.statusText);
            }
        }
    }



});

httpsServer.on("upgrade", (req, socket, head) => {
    Console.log(`Upgrade request for ${req.headers.host}${req.url}`);
    Console.log("REQ URL:", req.url);
    Console.log("REQ HEADERS:", req.headers);
    Console.log("REQ HOST:", req.url);

    // Delegate upgrade to the WS server
    // wss.handleUpgrade(req, socket, head, (ws) => {
    //     wss.emit("connection", ws, req); // This triggers the `connection` handler
    // });

    const socketManifestService = serviceDispatcher.getServiceFromRequest(req);
    if(socketManifestService){

        //NOTE: only the mqtt broker service has a dedicated websocket port:"websocket_port" . The backend uses the external port:"external_port"
        const upstream = net.connect(socketManifestService.config.websocket_port || socketManifestService.config.external_port, socketManifestService.config.host, function(){

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

});

//spin up additional services and brokers such as MQTT Mosquito.
Promise.all([

    new Promise((resolve, reject) => {

        let serviceId = manifest.ServiceIds.MONGO_DB;

        try {

            const result = dockerManager.prepareAndRunMongoDb(manifest.services[manifest.ServiceIds.MONGO_DB], {
                runningEnv:"development",
                forceRestart:false
            });

            if (result === "already_running") {
                dockerManager.emitDockerEvent(serviceId);
                resolve(serviceId);
            } else {
                dockerManager.waitUntilContainerIsHealthy(serviceId)
                    .then(() => {
                        dockerManager.emitDockerEvent(serviceId);
                        resolve(serviceId);
                    })
                    .catch(err => {
                        Console.error(err.message);
                        reject(`Failed waiting for ${serviceId} to become healthy`);
                    });
            }
        } catch (err) {
            Console.error(err.message);
            reject(`Failed to start ${serviceId}: ${err.message}`);
        }

    }),

    new Promise((resolve, reject)=>{

        let serviceId = manifest.ServiceIds.MQTT_BROKER;

        // Start or ensure MQTT broker is running
        try{
            const result = dockerManager.startMosquittoBroker(serviceId);
            Console.debug(`MQTT broker operation result:${result}`);

            if(result === "alredy_running"){
                dockerManager.emitDockerEvent(serviceId);
                resolve(serviceId);
            }
            else{
                // For both "started_existing" and "created_new" cases, wait for readiness
                dockerManager.waitForContainerReady(serviceId)
                    .then(() => {
                        dockerManager.emitDockerEvent(serviceId);
                        resolve(serviceId);
                    })
                    .catch(err => {
                        Console.error(err.message);
                        reject(`Failed waiting for ${serviceId}`);
                    });
            }
        }catch (err) {
            Console.error(err);
            reject(`Failed to start ${serviceId}: ${err.message}`);
        }

    })

    // new Promise((resolve, reject)=>{
    //
    //     let serviceId = manifest.ServiceIds.STRESS_AGENT;
    //     let stressAgentManifest = manifest.services[serviceId];
    //
    //     try{
    //         dockerManager.checkContainerRunning(serviceId).then((isRunning) => {
    //             Console.debug("service:", serviceId, "is running:", isRunning);
    //             if(!isRunning){
    //
    //                 dockerManager.prepareAndRunContainer(stressAgentManifest,{
    //                     runningEnv:process.env.ENV,
    //                     forceRestart:false
    //                 });
    //
    //
    //                 dockerManager.waitForContainerReady(serviceId).then(() => {
    //                     Console.debug(`container ${serviceId} is now running`);
    //
    //                     dockerManager.waitUntilContainerIsHealthy(serviceId).then((isHealthy)=>{
    //                         if(isHealthy){
    //                             Console.debug(`container ${serviceId} is now ready`);
    //                             resolve(serviceId);
    //                         }
    //                         else{
    //                             Console.error(`container ${serviceId} didn't got into ready state`);
    //                             reject(`container ${serviceId} didn't got into ready state`);
    //                         }
    //                     }).catch(err=>{
    //                         Console.error(err);
    //                         reject(`container ${serviceId} exception: ${err.message}`);
    //                     });
    //
    //                 }).catch(err => {
    //                     Console.error(err);
    //                     reject(`container ${serviceId} exception: ${err.message}`);
    //                 });
    //
    //             }
    //             else{
    //                 Console.debug(`Service: ${serviceId} is already running`);
    //                 resolve(serviceId);
    //             }
    //
    //         }).catch(err => {
    //             Console.error(err);
    //             reject(`container ${serviceId} exception: ${err.message}`);
    //
    //         });
    //     }catch (err) {
    //         Console.error(err.message);
    //         reject(`Failed to start ${serviceId}: ${err.message}`);
    //         reject(`container ${serviceId} exception: ${err.message}`);
    //     }
    //
    // })

]).then( async (resolved)=>{

    Console.info("resolved: service IDS:", resolved);

    setIntervalImmediate(monitorRunningContainers, 5000);

    MqttService({
        uri: process.env.MQTT_BROKER_URL
    });

    httpsServer.listen(443, () => {
        Console.log("HTTPS proxy server listening on port 443");
    });

}).catch(failures=>{
    Console.error("Failed to start proxy, one or more services didn't start", failures);
});


