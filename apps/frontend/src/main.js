import App from "./modules/App/App.js";

const app = App.getInstance({});
document.querySelector('#app').appendChild(app.element);

const webSocket = new WebSocket(`wss://${location.hostname}`);

// Connection opened
webSocket.addEventListener("open", (event) => {
    webSocket.send("Hello Server!");
});

// Listen for messages
webSocket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);
});
