import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.js'
import { sayHello } from "@workspace/common";

import App from "./modules/App/App.js";

//import CryptoService from "@workspace/common/services/CryptoService.js";

//const cryptoService = CryptoService.getInstance();
const appId = "cryptoService.generateRandomBytes()";

document.querySelector('#app').innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1 id="message">Hello Vite</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click  on the Vite logo to learn more
    </p>
    <foot>
    <span>appID: ${appId}</span>
</foot>
  </div>
`

setupCounter(document.querySelector('#counter'))

document.getElementById("message").textContent = sayHello(`Vite My App`);
console.log(`Vite frontend, instance: ${appId} is working!`);

const app = App.getInstance({});
document.body.appendChild(app.element);


const webSocket = new WebSocket(`wss://${location.hostname}`);
// Connection opened
webSocket.addEventListener("open", (event) => {
    webSocket.send("Hello Server!");
});

// Listen for messages
webSocket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);
});
