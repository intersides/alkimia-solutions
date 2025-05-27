import path from "node:path";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpErrorGeneric, HttpResponse} from "@workspace/node/ServerResponse.js";
const url = await import("url");
import Console from "@intersides/console";
import {MimeType} from "@workspace/common/enums.js";
import * as fs from "node:fs";


Console.log("process.env:", process.env);

const PROTOCOL = process.env.PROTOCOL || "http";
let SUBDOMAIN = process.env.SUBDOMAIN || null;
const DOMAIN = process.env.DOMAIN || "localhost";
const PORT = process.env.PORT || 3000;

const fullDomain = [SUBDOMAIN, DOMAIN].join(".");
const publicAddress = `${PROTOCOL}://${fullDomain}`;

Console.debug("PORT", PORT);

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __appRoot = path.resolve(__dirname, "./");

try{
    let cert = fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS, {encoding:"utf-8"});
    Console.debug("fullchain.pem:", cert);
}
catch(e){
    Console.error(e.message);
}

globalThis.__appRoot = __appRoot;
Console.log("globalThis.__appRoot:", globalThis.__appRoot);

async function runStressTestOnBackend() {

    return new Promise(async (resolve, reject) => {

        try {
            let targetUrl = "https://server.alkimia.localhost/stress?intensity=100&duration=120000";
            // Call the stress endpoint with high intensity for 30 seconds
            const response = await fetch(targetUrl);
            const result = await response.json();
            console.log("Stress test started:", result);
            resolve(result);
        } catch (error) {
            console.error("Error starting stress test:", error);
            reject(error);
        }
    });


}

async function runStressIncrementalTestOnBackend() {

    return new Promise(async (resolve, reject) => {

        try {
            // Call the stress endpoint with high intensity for 30 seconds
            const response = await fetch("https://server.alkimia.localhost/stress/incremental?steps=10&maxIntensity=100&stepDuration=10000");
            const result = await response.json();
            console.log("Stress Incremental started:", result);
            resolve(result);
        } catch (error) {
            console.error("Error starting stress incremental test:", error);
            reject(error);
        }
    });


}

Server.getInstance({
    publicAddress,
    port:PORT,
    router: Router.getInstance({
        routes:{
            GET:{
                "/":{
                    handler:function(){
                        return HttpResponse({
                            data: { msg: "hello stress-agent" }
                        });
                    }
                },
                "/ping": {
                    isProtected: false,
                    handler: () => HttpResponse({
                        data: {msg: "pong"},
                        mimeType:MimeType.JSON
                    })
                },
                "/stress":{
                    handler: async function(){

                        runStressTestOnBackend().then(result=>{
                            Console.debug("result" ,result);
                        }).catch(error=>{
                            Console.error(error.message);
                        });

                        return HttpResponse({
                            data: { msg: "should stress the backend" }
                        });


                    }
                },
                "/stress-incremental":{
                    handler: async function(){

                        runStressIncrementalTestOnBackend().then(result=>{
                            Console.debug("result" ,result);
                        }).catch(error=>{
                            Console.error(error.message);
                        });

                        return HttpResponse({
                            data: { msg: "should stress the backend incrementally" }
                        });


                    }
                }
            }

        }
    })
});
