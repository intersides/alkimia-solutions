import {utilities as Utilities} from "@alkimia/lib";
import {EventEmitter} from "node:events";
import {exec, execSync} from "node:child_process";
import fs from "node:fs";
import path from "path";
import {fileURLToPath} from "url";

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function DockerService(_args = null){

    const instance = Object.create(DockerService.prototype);

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

    /**
     *
     * @param containerName
     * @return {boolean}
     */
    function containerIsRunning(containerName){
        let isRunning = "false";
        try{
            isRunning = execSync(`docker inspect -f '{{.State.Running}}' ${containerName}`, {encoding: 'utf8'});
        }
        catch(e){
            console.error(e.message);
        }
        return isRunning.trim().toLowerCase() === "true";
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

    function startContainer(name, service, port, forceRestart=false){

        let isRunning = containerIsRunning('alkimia-backend');
        if(isRunning && forceRestart){
            stopContainer(name);
        }
        else if(isRunning){
            console.info(`container ${name} is already running`);
            return;
        }

        console.log(`Starting container ...`, __dirname);

        let ENV = "development";

        const buildCommand = `docker build . -t ${name} \
          --build-arg SERVICE=${service} \
          --build-arg ENV=${ENV}`;

        execSync(buildCommand, {
            cwd: __dirname, // ensures Docker context is correct
            stdio: "inherit" // streams output live to the console
        });

        let volumeFlags = [
            `-v /app/node_modules`,
            `-v /app/dist`
        ];
        if(ENV === "development"){
            // const root = process.cwd();
            volumeFlags.push(`-v ${__dirname}/apps/${service}:/app`);
            volumeFlags.push(`-v ${__dirname}/libs:/app/libs`);
        }
        volumeFlags = volumeFlags.join(" ");

        const runCommand = `docker run -d \
          --name ${name} \
          -p ${port}:${envVars.DOCKER_FILE_PORT} \
          -e ENV=${ENV} \
          -e PROTOCOL=${envVars.PROTOCOL} \
          -e DOMAIN=${envVars.DOMAIN}\
          -e SUBDOMAIN=${service} \
          ${volumeFlags} \
          ${name}`;

        console.debug("about to execute command", runCommand);

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

    instance.containerIsRunning = containerIsRunning;
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
 * @return {DockerService}
 */
DockerService.getSingleton = function(_args = null){
    if(!_instance){
        _instance = DockerService(_args);
    }
    return _instance;
};

/**
 *
 * @return {DockerService}
 */
DockerService.getInstance = function(_args = null){
    return DockerService(_args);
};
