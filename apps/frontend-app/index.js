import { sayHello } from "@workspace/common";
import { getUserAgent } from "@workspace/browser";

console.log(sayHello("Frontend App"));
console.log("User Agent:", getUserAgent());
