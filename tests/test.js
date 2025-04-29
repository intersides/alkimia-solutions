import { sayHello } from "@workspace/common";
import { getUserAgent } from "@workspace/browser";
import { getSystemInfo } from "@workspace/node";
import Console from "@intersides/console";

Console.log(sayHello("Workspace"));
Console.log(typeof window !== "undefined" ? getUserAgent() : "Not in a browser");
Console.log(getSystemInfo());
