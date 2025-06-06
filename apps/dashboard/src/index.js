import App from "./modules/App.js";
import WebSocketService from "./modules/WebSocketService.js";
import MqttService from "./modules/MqttService.js";

let app = App({
    websocketService:WebSocketService({
        url:"wss://dashboard.alkimia.localhost"
    }),
    mqttService: MqttService({
        url:"wss://mqtt.alkimia.localhost"
    })
});
app.appendTo(document.querySelector("#app"));
