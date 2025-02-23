import http from "http";
import { sayHello } from "@workspace/common";
import { getSystemInfo } from "@workspace/node";

console.log("!NODE_ENV:", process.env.NODE_ENV);

const PORT = 3000;


const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });

    const response = {
        message: sayHello("Backend Server"),
        system: getSystemInfo(),
    };

    res.end(JSON.stringify(response));
});

server.listen(PORT, () => {
    console.log(`✅ Backend server running at http://localhost:${PORT}`);
});
