import App from "./modules/App.js";

let app = App.getInstance({});
console.log(app);
document.querySelector("#app").appendChild(app.element);

// const webSocket = new WebSocket(`wss://${location.hostname}`);

let websocketServerUrl = "server.alkimia.localhost";
const webSocket = new WebSocket(`wss://${websocketServerUrl}`);

// Connection opened
webSocket.addEventListener("open", (event) => {
    console.debug("Connected to :", websocketServerUrl);
    webSocket.send("message from frontend");
});

// Listen for messages
webSocket.addEventListener("message", (event) => {
    console.log(`Message from server[${websocketServerUrl}]:`, event.data);
});

