import fs from "node:fs";
import DockerService from "../DockerService.js";
import {parseEnvFile} from "@workspace/common";
import path from "path";
import {fileURLToPath} from "url";
const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));

console.log("_projectRootPath", _projectRootPath);

let envContent = fs.readFileSync(`${_projectRootPath}/.env`, {encoding:"utf-8"});
let envObj = parseEnvFile(envContent);
console.log(envObj);

let dockerService = DockerService.getInstance({
    envVars:envObj
});

console.debug(dockerService);

// Listen for container ready event
dockerService.on("container-started", (params) => {
    console.log(`Container ${params.name} is ready! Starting HTTPS proxy...`);

    // setTimeout(()=>{
    //     console.debug("stop..", params.name);
    //     if(docker.containerIsRunning(params.name)){
    //         docker.stopContainer(params.name);
    //     }
    //     else{
    //         console.warn(`container ${params.name} is not running`);
    //     }
    // }, 5000);

});

dockerService.on("container-stressed", (container) => {
    console.log(`container ${container.name} is under stress`);
});

if(! dockerService.imageExists("intersides-workspace-base")){
    dockerService.buildBaseImage();
}

// dockerService.startContainer({
//     name:"intersides-workspace-backend",
//     service:"backend",
//     port:8080,
//     forceRestart:true
// });

dockerService.startContainer({
    name:"intersides-workspace-frontend",
    service:"frontend",
    port:7070,
    forceRestart:true
});

