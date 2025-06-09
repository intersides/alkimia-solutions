import DockerManager from "../DockerManager.js";
import path from "node:path";
import Console from "@intersides/console";
import Manifest from "../services-manifest.js";

const root = path.resolve(process.cwd(), "../");
Console.debug("root:", root);

const manifest = Manifest({
    root:root
});

let dockerManager = DockerManager({
    root:root,
    envVars:{},
    manifest
});

dockerManager.prepareAndRunContainer(manifest.services["alkimia-backend"], {
    runningEnv: "development",
    forceRestart: true
});
