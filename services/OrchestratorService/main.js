import path from "node:path";
import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import {HttpErrorGeneric, HttpResponse} from "@workspace/node/ServerResponse.js";
const url = await import("url");
import Console from "@intersides/console";
import {MimeType} from "@workspace/common/enums.js";
import mqtt from "mqtt";

Console.log("process.env:", process.env);

let  mqttClient = null;
mqttClient = mqtt.connect("mqtt://mqtt-alkimia-broker/");
mqttClient.on("connect", () => {
    Console.debug("[LOAD_BALANCER] MQTT connected");

    mqttClient.subscribe("test/ping", (err) => {
        if (err) {
            console.error("[LOAD_BALANCER] MQTT Subscribe error:", err.message);
        } else {
            console.log("[LOAD_BALANCER] MQTT Subscribed to test/ping");
        }
    });

    Console.warn("about to publish on services/network...");
    mqttClient.publish("services/network", JSON.stringify({service:"load-balancer", message:{
        event:"connection",
        status:"connected"
    }}), {qos:2});


});
mqttClient.on("message", (topic, message) => {
    Console.debug("[LOAD_BALANCER] MQTT message:", topic, message.toString());
});
mqttClient.on("error", (err) => {
    Console.error("[LOAD_BALANCER] MQTT connection error", err);
});

const PORT = process.env.PORT || 3000;

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __appRoot = path.resolve(__dirname, "./");

globalThis.__appRoot = __appRoot;
Console.log("globalThis.__appRoot:", globalThis.__appRoot);

Server.getInstance({
    port: PORT,
    router: Router.getInstance({
        routes:{


            GET:{
                "/ping": {
                    isProtected: false,
                    handler: () => HttpResponse({
                        data: {msg: "pong"},
                        mimeType:MimeType.JSON
                    })
                },
                "/":{
                    handler:function(){
                        return HttpResponse({
                            data: { msg: "hello load-balancer" }
                        });
                    }
                }
            }

        }
    })
});
