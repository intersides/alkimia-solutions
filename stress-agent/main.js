import path from "node:path";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpResponse} from "@workspace/node/ServerResponse.js";
const url = await import("url");
import Console from "@intersides/console";

Console.log("process.env:", process.env);

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __appRoot = path.resolve(__dirname, "./");

globalThis.__appRoot = __appRoot;
Console.log("globalThis.__appRoot:", globalThis.__appRoot);


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
                    handler:function(){

                        fetch("https://server.alkimia.localhost/").then(response=>{
                            console.debug("DEBUG: response", response);
                        }).catch(exc=>{
                            console.error("Error: exc", exc);
                        }).finally(()=>{

                        });

                        return HttpResponse({
                            data: { msg: "should stress a service" }
                        });

                    }
                }
            }

        }
    })
});
