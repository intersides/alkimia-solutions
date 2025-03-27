import http from "http";
import { sayHello, printServerInfo } from "@workspace/common";
import { getSystemInfo } from "@workspace/node";

const PORT = 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });

    const response = {
        message: sayHello(" My Backend Server"),
        system: getSystemInfo(),
    };

    res.end(JSON.stringify(response));
});

server.listen(PORT, () => {
    printServerInfo(process.env.PROTOCOL, process.env.SUBDOMAIN+"."+process.env.DOMAIN, null, process.env.ENV);
    console.log("system info: ", getSystemInfo());
});
