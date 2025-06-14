import path from "node:path";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpErrorGeneric, HttpResponse} from "@workspace/node/ServerResponse.js";
import Console from "@intersides/console";
import {MimeType} from "@workspace/common/enums.js";
import * as fs from "node:fs";
const url = await import("url");


Console.log("process.env:", process.env);

const PROTOCOL = process.env.PROTOCOL || "http";
let SUBDOMAIN = process.env.SUBDOMAIN || null;
const DOMAIN = process.env.DOMAIN || "localhost";
const PORT = process.env.PORT || 3000;

const fullDomain = [SUBDOMAIN, DOMAIN].join(".");
const publicAddress = `${PROTOCOL}://${fullDomain}`;

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __appRoot = path.resolve(__dirname, "./");
globalThis.__appRoot = __appRoot;

const staticDir = `${globalThis.__appRoot}/static`;
const sharedDir = `${globalThis.__appRoot}/libs`;
const modulesDir = `${globalThis.__appRoot}/node_modules`;

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

async function fillMemoryTestOnBackend() {

    return new Promise(async (resolve, reject) => {

        let intercalRef = setInterval(async function(){
            await fetch("https://server.alkimia.localhost/ping");
        }, 2000);

        try {
            let targetUrl = "https://server.alkimia.localhost/fillMemory";
            // Call the stress endpoint with high intensity for 30 seconds
            const response = await fetch(targetUrl);

            if (!response.ok) {
                console.error(`HTTP error: ${response.status} ${response.statusText}`);
                clearInterval(intercalRef);
                reject(new Error(`Request failed: ${response.status}`));
            }
            else{
                const result = await response.json();
                console.log("Fill backend memory completed:", result);
                clearInterval(intercalRef);
                resolve(result);
            }

        } catch (error) {
            console.error("Error starting fill backend memory:", error);
            reject(error);
        }
    });

}

async function stressCpuAnyMemory() {

    return new Promise(async (resolve, reject) => {

        try {
            let targetUrlMem = "https://server.alkimia.localhost/fillMemory";
            // Call the stress endpoint with high intensity for 30 seconds
            const responseMem = await fetch(targetUrlMem);
            const resultMem = await responseMem.json();
            console.log("Fill backend memory started:", resultMem);

            let targetUrlCpu = "https://server.alkimia.localhost/stress?intensity=100&duration=120000";
            // Call the stress endpoint with high intensity for 30 seconds
            const responseCpu = await fetch(targetUrlCpu);
            const resultCpu = await responseCpu.json();
            console.log("Stress test started:", resultCpu);
            resolve( {
                resultMem,
                resultCpu
            });
        } catch (error) {
            console.error("Error starting fill backend memory:", error);
            reject(error);
        }
    });

}

async function runStressIncrementalTestOnBackend() {

    return new Promise(async (resolve, reject) => {

        try {
            // Call the stress endpoint with high intensity for 30 seconds
            const response = await fetch("https://server.alkimia.localhost/stress/incremental?steps=10&maxIntensity=100&stepDuration=80000");
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
        staticDir,
        sharedDir,
        modulesDir,
        routes:{
            GET:{
                "/":{
                    handler:function(){
                        return HttpResponse(
                            {
                                data:`
                                    <!doctype html>
                                    <html lang="en">
                                        <head>
                                            <meta charset="UTF-8"/>
                                            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
                                            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                                            <link rel="stylesheet" href="index.css" >
                                            <link rel="icon" type="image/x-icon" href="favicon.ico">
                                            <script type="module" src="index.js"></script>
                                            <title>Alkimia Stress Agent Dashboard</title>
                                            </head>
                                            <body>
                                                <script type="importmap">
                                                    {
                                                        "imports": {
                                                        "@alkimia/lib": "/node_modules/@alkimia/lib/index.mjs",
                                                        "@workspace/common": "/shared/libs/common/index.js"
                                                        }
                                                    }
                                                </script>
                                                <script>
                                                    window.addEventListener('load', () => {
                                                        console.log('Fully loaded including images, CSS, etc.');
                                                    });
                                                </script>
                                            </body>
                                    </html>`,
                                mimeType: MimeType.HTML
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
                "/fillUpBackendMemory":{
                    handler: async function(){

                        fillMemoryTestOnBackend().then(result=>{
                            Console.debug("result" ,result);
                        }).catch(error=>{
                            Console.error(error.message);
                        });

                        return HttpResponse({
                            data: { msg: "should stress memory of the backend" }
                        });


                    }
                },
                "/stressCpuAnyMemory":{
                    handler: async function(){

                        stressCpuAnyMemory().then(result=>{
                            Console.debug("result" ,result);
                        }).catch(error=>{
                            Console.error(error.message);
                        });

                        return HttpResponse({
                            data: { msg: "should stress memory of the backend" }
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
