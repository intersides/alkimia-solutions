import App from "./modules/App.js";
import WebSocketService from "./modules/WebSocketClient.js";

let app = App({
    wsService:WebSocketService({
        url:"wss://stressagent.alkimia.localhost"
    })
});
document.querySelector("body").appendChild(app.element);
