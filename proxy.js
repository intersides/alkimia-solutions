import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";
import DockerService from "./DockerService.js";
import { WebSocketServer } from "ws";
import {parseEnvFile} from "@workspace/common";
import Console from "@intersides/console";
import * as net from "node:net";
import mqtt from "mqtt";

const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

const keyPath = path.join(_projectRootPath, "./certs/key.pem");
const certPath = path.join(_projectRootPath, "./certs/fullchain.pem");

const key = fs.readFileSync(keyPath, {encoding: "utf-8"});
const cert = fs.readFileSync(certPath, {encoding: "utf-8"});

let envContent = fs.readFileSync(`${_projectRootPath}/.env`, {encoding:"utf-8"});
let envVars = parseEnvFile(envContent);
Console.log("environment variables:", envVars);

let dockerService = DockerService.getInstance({
    envVars
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

    dockerService.checkContainerRunning(target.service).then((isRunning) => {
        Console.debug("service:", target.service, "is running:", isRunning);
        if(!isRunning){
            dockerService.startContainer({
                name:target.service,
                service:target.name,
                port: target.port
            });

            dockerService.waitForContainerReady(target.service).then(() => {
                Console.debug(`container ${target.service} is now running`);

                proxyRequest(target, req, res);

            }).catch(err => {
                Console.error(err);
            });

        }
        else{
            Console.debug("forwarding request :", req.url, "to service:", target.service);

            proxyRequest(target, req, res);
        }

    }).catch(err => {
        Console.error(err);
    });

});

mqttClient = mqtt.connect("mqtt://mqtt.alkimia.localhost/");
mqttClient.on("connect", () => {
    Console.log("[PROXY] MQTT connected");

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
    Console.log("[PROXY] MQTT message:", topic, message.toString());
});
mqttClient.on("error", (err) => {
    Console.error("[PROXY] MQTT connection error", err);
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

        dockerService.checkContainerRunning("intersides-mqtt-broker").then((isRunning) => {
            if(!isRunning){
                dockerService.startMosquittoBroker();
                dockerService.waitForContainerReady("intersides-mqtt-broker").then(() => {
                    resolve("container intersides-mqtt-broker is now running");
                }).catch(err => {
                    Console.error(err.message);
                    reject("failed waiting for intersides-mqtt-broker");
                });
            }
            else{
                resolve("service:intersides-mqtt-broker is already running");
            }

        }).catch(err => {
            Console.error(err.message);
            reject("failed to check if intersides-mqtt-broker is running");
        });
    })
]).then(resolved=>{
    Console.info(resolved);

    httpsServer.listen(443, () => {
        Console.log("HTTPS proxy server listening on port 443");
    });

}).catch(failures=>{
    Console.error("Failed to start proxy, one or more services didn't start", failures);
});


