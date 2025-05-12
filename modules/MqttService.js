import Utilities from "@alkimia/lib/src/Utilities.js";
import Console from "@intersides/console";

import mqtt from "mqtt";

export default function MqttService(_args){
    let instance = Object.create(MqttService.prototype, {});

    let {
        brokerUrl
    } = Utilities.transfer(_args, {
        brokerUrl:null
    });

    let  mqttClient = null;


    function _init(){
        Console.debug("DEBUG: url", brokerUrl);
        mqttClient = mqtt.connect(brokerUrl);
        _registerEventListeners();

        return instance;
    }

    function _registerEventListeners(){
        if(mqttClient){
            mqttClient.on("connect", () => {
                Console.debug("[PROXY] MQTT connected");


                mqttClient.subscribe("test/ping", (err) => {
                    if (err) {
                        console.error("[PROXY] MQTT Subscribe error:", err.message);
                    } else {
                        console.log("[PROXY] MQTT Subscribed to test/ping");
                    }
                });

                mqttClient.subscribe("services/network", (err) => {
                    if (err) {
                        console.error("[PROXY] MQTT Subscribe error:", err.message);
                    } else {
                        console.log("[PROXY] MQTT Subscribed to test/ping");
                    }
                });

                setTimeout(()=>{
                    mqttClient.publish("test/ping", "hello from proxy", {qos:2});
                }, 5000);

            });

            mqttClient.on("message", (topic, message) => {
                Console.warn("[PROXY] MQTT message:", topic, message.toString());
                if(topic === "services/network"){
                    const topicMessage = JSON.parse(message.toString());
                    Console.debug("[PROXY] MQTT topicMessage:", topic, topicMessage);
                }
            });

            mqttClient.on("error", (err) => {
                Console.error("[PROXY] MQTT connection error", err);
            });
        }
        else{
            Console.error("mqttClient is null");
        }

    }

    return _init();
}

let singleTone = null;
MqttService.getSingleton = function(_args){
    if(!singleTone){
        singleTone = MqttService(_args);
    }
    return singleTone;
};
