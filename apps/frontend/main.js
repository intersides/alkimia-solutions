import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpResponse} from "@workspace/node/ServerResponse.js";
import {MimeType} from "@workspace/common/enums.js";
import path from "node:path";
const url = await import("url");

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __appRoot = path.resolve(__dirname, "./");

globalThis.__appRoot = __appRoot;

const staticDir = `${globalThis.__appRoot}/src`;
const sharedDir = `${globalThis.__appRoot}/libs`;
const modulesDir = `${globalThis.__appRoot}/node_modules`;

const PORT = process.env.PORT || 3000;
const PUBLIC_PORT = process.env.PUBLIC_PORT || PORT;
const PROTOCOL = process.env.PROTOCOL || "https";
const SUBDOMAIN = process.env.SUBDOMAIN || "";
const DOMAIN = process.env.DOMAIN || "localhost";

Server.getInstance({
    port:PORT,
    publicAddress: `${PROTOCOL}://${!!SUBDOMAIN ? SUBDOMAIN+"." : ""}${DOMAIN}:${PUBLIC_PORT}`,
    router : Router.getInstance({
        staticDir,
        sharedDir,
        modulesDir,
        routes: {
            GET: {
                "/hello": {
                    isProtected: false,
                    handler: ()=>HttpResponse({
                        data: {msg:"hello"},
                        mimeType: MimeType.JSON
                    })
                },
                "/": {
                    isProtected: false,
                    handler: ()=>{
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
                                            <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
                                            <script type="module" src="main.js"></script>
                                            <title>Frontend App</title>
                                            </head>
                                            <body>
                                                <h2>Some text !!</h2>
                                                <img alt="no-face" src="noface.png">
                                                <img alt="logo" width="150px" src="intersides_logo.svg">
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
                                                      
                                                        const mqttClient = mqtt.connect('wss://mqtt.alkimia.localhost');

                                                        mqttClient.on('connect', () => {
                                                            console.log('[MQTT] Connected to broker');
                                                        
                                                            // Subscribe to a test topic
                                                            mqttClient.subscribe('test/ping', (err) => {
                                                                if (err) {
                                                                    console.error('[MQTT] Subscribe error:', err.message);
                                                                } else {
                                                                    console.log('[MQTT] Subscribed to test/ping');
                                                                }
                                                            });
                                                        
                                                            // Publish a test message
                                                            mqttClient.publish('test/ping', 'proxy is alive');
                                                            
                                                        });
                                                        
                                                        mqttClient.on('message', (topic, message) => {
                                                            console.debug("message from mqtt", arguments);
                                                        //     console.log(\`[MQTT] Message received on topic:\`, message.toString());
                                                        });

                                                      
                                                    });
                                                  </script>
                                            </body>
                                    </html>`,
                                mimeType: MimeType.HTML
                            });
                    }
                }
            }
        }
    })
});

