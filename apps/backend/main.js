import http from "http";
import { sayHello, printServerInfo } from "@workspace/common";
import { getSystemInfo } from "@workspace/node";
import CryptoService from "@workspace/common/services/CryptoService.js"

const PORT = 3000;

const cryptoService = CryptoService.getInstance();

const appInstanceId = cryptoService.generateRandomBytes();

const server = http.createServer((req, res) => {

    console.log("requesting:", req.url);

    res.writeHead(200, { "Content-Type": "application/json" });

    if(req.url === "/api/hello"){
        return res.end(JSON.stringify({msg:"world"}));
    }
    else if(req.url === "/api/setCounter"){

        return res.end(JSON.stringify({value:0}));
    }

    const response = {
        message: sayHello(" My Proxied Backend Server"),
        system: getSystemInfo(),
        appInstanceId
    };

    res.end(JSON.stringify(response));

});

server.listen(PORT, () => {
    console.debug("****");
    printServerInfo(process.env.PROTOCOL, process.env.SUBDOMAIN+"."+process.env.DOMAIN, null, process.env.ENV);
    console.log("system info: ", getSystemInfo());
});
