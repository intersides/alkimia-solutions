import { sayHello } from "@workspace/common";
import { getSystemInfo } from "@workspace/node";

console.log(sayHello("Backend Server"));
console.log("System Info:", getSystemInfo());
