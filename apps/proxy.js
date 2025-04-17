import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.join(__dirname, "../", "./traefik/local-certs/key.pem")
const certPath = path.join(__dirname, "../", "./traefik/local-certs/fullchain.pem")

const key = fs.readFileSync(keyPath, {encoding:"utf-8"});
const cert = fs.readFileSync(certPath, {encoding:"utf-8"});

// HTTPS proxy (port 443) with SSL termination
const sslOptions = {
    key,
    cert
};

// Define routing rules
const routingRules = [
    {
        // Route based on hostname
        match: (req) => req.headers.host === 'app.alkimia.localhost',
        target: { host: 'localhost', port: 7070 }
    },
    {
        // Route based on hostname
        match: (req) => req.headers.host === 'server.alkimia.localhost',
        target: { host: 'localhost', port: 8080 }
    },
    // {
    //     // Route based on path
    //     match: (req) => req.url.startsWith('/api/'),
    //     target: { host: 'localhost', port: 7070 }
    // },
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
const httpsServer = https.createServer(sslOptions, function(req, res){
    // Log the incoming request
    console.log(`Received request: ${req.method} ${req.url}`);
    console.log(`Host header: ${req.headers.host}`);

    // Determine target server based on routing rules
    const route = routingRules.find(rule => rule.match(req));
    let target = {
        host:"localhost",
        port:8080
    };
    if(route?.target){
        target = route.target;
    }

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
        res.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Pipe the response data
        proxyRes.pipe(res);
    });

    // Forward the request body
    req.pipe(proxyReq);

    // Handle errors
    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err);
        if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
        } else {
            res.end();
        }
    });


});

httpsServer.listen(443, () => {
    console.log('HTTPS proxy server listening on port 443');
});