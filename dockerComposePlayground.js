import DockerComposeService from "./DockerComposeService.js";

let docker = DockerComposeService.getInstance({});

console.debug(docker);

// Listen for container ready event
docker.on('container-started', (params) => {
    console.log(`Container ${params.name} is ready! Starting HTTPS proxy...`);

    setTimeout(()=>{
        console.debug("stop..", params.name);
        docker.stopContainer(params.name);
    }, 4000);

});

docker.startContainer('alkimia-backend', "backend", '8080');
docker.startContainer('alkimia-frontend', "frontend", '7070');

