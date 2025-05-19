import DockerService from "../DockerService.js";
import dotenv from "dotenv";
import path from "path";
import {fileURLToPath} from "url";
const _projectRootPath = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
console.log("_projectRootPath", _projectRootPath);

let dockerService = DockerService.getInstance({
    envVars:process.env
});

console.debug(dockerService);

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

