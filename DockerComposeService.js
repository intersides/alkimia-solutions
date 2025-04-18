import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function DockerComposeService(_args = null){

    const instance = Object.create(DockerComposeService.prototype);

    const {} = Utilities.transfer(_args, {});

    // Load environment variables from .env file
    const envFile = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    const envVars = {};

    const emitter = new EventEmitter();

    envFile.split("\n").forEach(line => {
        if(line && !line.startsWith("#")){
            const [key, value] = line.split("=");
            if(key && value){
                envVars[key.trim()] = value.trim();
            }
        }
    });

    function _init(){
        return instance;
    }

    // Wait for the container to be ready
    function waitForContainerReady(containerName){
        console.log(`Waiting for container ${containerName} to be ready...`);

        // Simple approach: wait a few seconds
        return new Promise(resolve => {
            setTimeout(() => {
                checkContainerRunning(containerName).then(isRunning => {
                    if(isRunning){
                        console.log(`Container ${containerName} is ready!`);
                        resolve();
                    }
                    else{
                        console.error(`Container ${containerName} is not running`);
                        throw new Error(`Container ${containerName} start timeout error`);
                    }
                });
            }, 3000); // Wait 3 seconds
        });
    }

    // Check if the container is running
    function checkContainerRunning(containerName){
        return runCommand(`docker inspect -f '{{.State.Running}}' ${containerName}`).then(output => output.includes("true")).catch(() => false);
    }

    // Stop and remove a container
    function stopContainer(containerName){
        console.log(`Stopping container ${containerName}...`);
        execSync(`docker rm -f ${containerName} || true`, {stdio: "inherit"});
    }

    function runCommand(command){
        return new Promise((resolve, reject) => {

            exec(command, (error, stdout, stderr) => {
                if(error){
                    console.error(`Error: ${stderr}`);
                    reject(error);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }

    function startContainer(name, service, port){
        console.log(`Starting container ...`, __dirname);
        console.log(`env ...`, envVars);

        let ENV = "development";

        const buildCommand = `docker build . -t ${name} \
          --build-arg SERVICE=${service} \
          --build-arg ENV=${ENV}`;

        execSync(buildCommand, {
            cwd: __dirname, // ensures Docker context is correct
            stdio: "inherit" // streams output live to the console
        });

        execSync(`docker rm -f ${name} || true`, {stdio: "inherit"});

        let volumeFlags = "";
        if(ENV === "development"){
            const root = process.cwd();
            volumeFlags = [
                `-v ${__dirname}/apps/${service}:/app`,
                `-v ${__dirname}/libs:/app/libs`,
                `-v /app/node_modules` // anonymous volume, Docker handles it
            ].join(" ");
        }

        const runCommand = `docker run -d \
          --name ${name} \
          -p ${port}:${envVars.DOCKER_FILE_PORT} \
          -e ENV=${ENV} \
          -e PROTOCOL=${envVars.PROTOCOL} \
          -e DOMAIN=${envVars.DOMAIN}\
          -e SUBDOMAIN=${service} \
          ${volumeFlags} \
          ${name}`;

        execSync(runCommand, {
            stdio: "inherit"
        });

        emitter.emit("container-started", {
            name: name,
            env: ENV,
            domain: envVars.DOMAIN,
            service: service,
            port: port
        });

    }

    instance.waitForContainerReady = waitForContainerReady;
    instance.startContainer = startContainer;
    instance.stopContainer = stopContainer;
    instance.checkContainerRunning = checkContainerRunning;
    instance.on = (event, listener) => emitter.on(event, listener);
    // instance.once =  (event, listener) => emitter.once(event, listener);
    // instance.off =  (event, listener) => emitter.off(event, listener);

    return _init();

}

let _instance = null;

/**
 *
 * @return {DockerComposeService}
 */
DockerComposeService.getSingleton = function(_args = null){
    if(!_instance){
        _instance = DockerComposeService(_args);
    }
    return _instance;
};

/**
 *
 * @return {DockerComposeService}
 */
DockerComposeService.getInstance = function(_args = null){
    return DockerComposeService(_args);
};
