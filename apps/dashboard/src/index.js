import App from "./modules/App.js";
import WebSocketService from "./services/WebSocketService/index.js";

let app = App({
    websocketService:WebSocketService({
        url:"wss://dashboard.alkimia.localhost"
    })
});
document.querySelector("#app").appendChild(app.element);
