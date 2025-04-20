import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";
import DockerService from "./DockerService.js";
import { WebSocketServer } from 'ws';
import {parseEnvFile} from "@workspace/common";

const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

const keyPath = path.join(_projectRootPath, "./certs/key.pem");
const certPath = path.join(_projectRootPath, "./certs/fullchain.pem");

const key = fs.readFileSync(keyPath, {encoding: "utf-8"});
const cert = fs.readFileSync(certPath, {encoding: "utf-8"});

let envContent = fs.readFileSync(`${_projectRootPath}/.env`, {encoding:"utf-8"});
let envVars = parseEnvFile(envContent);
console.log("environment variables:", envVars);

let dockerService = DockerService.getInstance({
    envVars
});

// HTTPS proxy (port 443) with SSL termination
const sslOptions = {
    key,
    cert
};

// Define routing rules
const routingRules = [
    {
        // Route based on path
        match: (req) => req.url.startsWith('/api/'),
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
    console.log(`Routing to: ${target.host}:${target.port}`);

    const proxyReq = http.request({
        host: target.host,
        port: target.port,
        path: req.url,
        method: req.method,
        headers: req.headers,
        agent: false  // Disable keep-alive
    }, (proxyRes) => {
        // Forward the response status and headers
        console.log("forwarding...", );
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Pipe the response data
        proxyRes.pipe(res);
    });

    // Forward the request body
    req.pipe(proxyReq);

    // Handle errors
    proxyReq.on("error", (err) => {
        console.error("Proxy request error:", err);
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
    console.log(`Received request: ${req.method} ${req.url}`);
    console.log(`Host header: ${req.headers.host}`);

    // Determine the target server based on routing rules
    const route = routingRules.find(rule => rule.match(req));
    const target = route?.target || {
        service: "alkimia-backend",
        name: "backend",
        host: "localhost",
        port: 8080
    };

    console.debug("target:", target);

    dockerService.checkContainerRunning(target.service).then((isRunning) => {
        console.debug(target.service, isRunning);
        if(!isRunning){
            dockerService.startContainer(target.service, target.name, target.port);

            dockerService.waitForContainerReady(target.service).then(() => {
                console.debug(`container ${target.service} is now running`);

                proxyRequest(target, req, res);

            }).catch(err => {
                console.error(err);
            });

        }
        else{
            proxyRequest(target, req, res);
        }

    }).catch(err => {
        console.error(err);
    });

});


const wss = new WebSocketServer({ server: httpsServer });
wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');

    ws.on('error', console.error);

    ws.on('message', function message(data) {
        console.log('received: %s', data);
        ws.send('hello from server');
    });
});



httpsServer.listen(443, () => {
    console.log("HTTPS proxy server listening on port 443");
});
