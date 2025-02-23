import { sayHello } from "@workspace/common";
import { getUserAgent } from "@workspace/browser";
import { getSystemInfo } from "@workspace/node";

console.log(sayHello("Workspace"));
console.log(typeof window !== "undefined" ? getUserAgent() : "Not in a browser");
console.log(getSystemInfo());
