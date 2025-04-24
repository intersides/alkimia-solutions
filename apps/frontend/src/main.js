import App from "./modules/App.js";

let app = App.getInstance({});
console.log(app);
document.querySelector("#app").appendChild(app.element);

const webSocket = new WebSocket(`wss://${location.hostname}`);

// Connection opened
webSocket.addEventListener("open", (event) => {
    webSocket.send("Hello Server!");
});

// Listen for messages
webSocket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);
});

