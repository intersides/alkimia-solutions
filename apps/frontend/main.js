import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpResponse} from "@workspace/node/httpLib.js";
import {MimeType} from "@workspace/common/enums.js";
import path from "node:path";
const url = await import("url");
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const __projectRoot = path.resolve(__dirname, "../../");
const __appRoot = path.resolve(__dirname, "./");

globalThis.__projectRoot = __projectRoot;
globalThis.__appRoot = __appRoot;


const staticDir = `${globalThis.__appRoot}/src`;
const sharedDir = `${globalThis.__projectRoot}/libs`;
const modulesDir = `${globalThis.__projectRoot}/node_modules`;

console.log("staticDir", staticDir);
console.log("sharedDir", sharedDir);
console.log("modulesDir", modulesDir);

//mimic env vars
let envVars = {
    ENV:"production"
};

let main = Server.getInstance({
    port:7171,
    router : Router.getInstance({
        staticDir,
        sharedDir,
        modulesDir,
        routes: {
            GET: {
                "/hello": {
                    isProtected: false,
                    handler: ()=>HttpResponse({msg:"hello"}, MimeType.JSON)
                },
                "/": {
                    isProtected: false,
                    handler: ()=>{
                        return HttpResponse(
                            `
                                    <!doctype html>
                                    <html lang="en">
                                        <head>
                                            <meta charset="UTF-8"/>
                                            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
                                            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                                            <link rel="stylesheet" href="index.css" >
                                            <link rel="icon" type="image/x-icon" href="favicon.ico">
                                            <script type="module" src="main.js"></script>
                                            <title>Frontend App</title>
                                            </head>
                                            <body>
                                                <h2>Some text !!</h2>
                                                <img src="noface.png">
                                                <img src="vite.svg">
                                                <div id="app"></div>
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
                            MimeType.HTML);
                    }
                }
            }
        }
    })
});

