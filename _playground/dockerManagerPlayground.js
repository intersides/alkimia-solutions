import DockerManager from "../DockerManager.js";
import ServiceDispatcher from "../modules/ServiceDispatcher.js";
import path from "node:path";
import Console from "@intersides/console";
import Manifest from "../services-manifest.js";

const root = path.resolve(process.cwd(), "../");
Console.debug("root:", root);

const manifest = Manifest({
    root:root
});

let playgroundBackendManifest = {
    name: "playground-backend",
    monitored:true,
    maxInstances:10,
    type:"docker-service",
    protocol: "http",
    mode: "rest-api",
    config:{
        host: "localhost",
        network: "playground-network",
        location:"apps/backend",
        dockerfile:"apps/backend/Dockerfile",
        public_domain:"server.alkimia.localhost",
        container_name:"playground-backend",
        ports:[
            "8080:3000"
        ],
        volumes:[
            "/app/node_modules",
            `${root}/apps/backend:/app`,
            `${root}/libs:/app/libs`
        ],
        env:{
            ENV:"staging",
            PUBLIC_PORT: "8080",
            PORT: "3000",
            PROTOCOL: "https",
            DOMAIN: "alkimia.localhost",
            SUBDOMAIN: "server"
        },
        external_port:8080,
        internal_port:3000
    }
};
manifest.services["playground-backend"] = playgroundBackendManifest;

let dockerManager = DockerManager({
    root:root,
    envVars:{},
    manifest
});

dockerManager.prepareAndRunContainer(playgroundBackendManifest, {
    runningEnv: "development",
    forceRestart: true
});
