import {utilities} from "@alkimia/lib";
import mqtt from "mqtt";

export default function MqttService(args){
    let instance = Object.create(MqttService.prototype, {});

    let { url }  = utilities.transfer(args, {
        url:null
    });

    let mqttClient = null;

    function _init(){
        if(!url){
            throw Error("url parameter must be passed");
        }

        mqttClient = mqtt.connect(url);
        _registerEventHandlers();

        return instance;
    }

    function onTopicMessage(topic, message){
        //need to be delegated
    }

    function _registerEventHandlers(){

        mqttClient.on("connect", () => {
            console.log("[MQTT] Connected to broker");


            mqttClient.subscribe("service/events", (err) => {
                if (err) {
                    console.error("MQTT service/events subscribe error:", err.message);
                } else {
                    console.log("MQTT Subscribed to service/events");
                }
            });

            // Publish a test message
            mqttClient.publish("test/ping", "dashboard is connected");

        });

        mqttClient.on("message", (_topic, _message) => {

            let message = _message;
            try{
                message = JSON.parse(_message);
            }
            catch(e){
                console.error("ERROR: failed parsing message as json", _message);
                console.error(e);
            }
            onTopicMessage(_topic, message);

        });

    }

    instance.onTopicMessage = function(delegate){
        onTopicMessage = delegate;
    };

    return _init();
}
