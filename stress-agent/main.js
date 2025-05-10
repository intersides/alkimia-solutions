import path from "node:path";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpErrorGeneric, HttpResponse} from "@workspace/node/ServerResponse.js";
const url = await import("url");
import Console from "@intersides/console";


Console.log("process.env:", process.env);

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __appRoot = path.resolve(__dirname, "./");

globalThis.__appRoot = __appRoot;
Console.log("globalThis.__appRoot:", globalThis.__appRoot);

async function runStressTestOnBackend() {

    return new Promise(async (resolve, reject) => {

        try {
            // Call the stress endpoint with high intensity for 30 seconds
            const response = await fetch("https://server.alkimia.localhost/api/stress?intensity=100&duration=120000");
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
            const response = await fetch("https://server.alkimia.localhost/api/stress/incremental?steps=10&maxIntensity=100&stepDuration=10000");
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
    port:8888,
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
