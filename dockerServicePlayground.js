import DockerService from "./DockerService.js";

let docker = DockerService.getInstance({});

console.debug(docker);

// Listen for container ready event
docker.on('container-started', (params) => {
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

// docker.startContainer('alkimia-backend', "backend", '8080');
docker.startContainer('alkimia-frontend', "frontend", '7070');

