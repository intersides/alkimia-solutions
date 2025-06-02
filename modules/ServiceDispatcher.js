import {utilities as Utilities} from "@alkimia/lib";
import Console from "@intersides/console";
import {HttpErrorStatus} from "@workspace/common/enums.js";

/**
 *
 * @param _args
 * @return {*}
 * @constructor
 */
export default function ServiceDispatcher(_args=null){
    let instance = Object.create(ServiceDispatcher.prototype, {});

    const { manifest, dockerManager } = Utilities.transfer(_args, {
        manifest:null,
        dockerManager:null
    });

    function _init(){
        Console.log("manifest:", manifest);
        return instance;
    }

    /**
     * Example logic to evaluate if scaling is required for a given service
     */
    function checkScalingCondition(serviceGroup) {

        let manifestService = manifest.services[serviceGroup];

        const { maxInstances = 1 } = manifestService; // Optionally define max instances in the manifest
        const currentInstances = dockerManager.getContainersByFilter(serviceGroup);

        Console.debug("maxInstances", maxInstances);
        Console.debug("currentInstances amount:", currentInstances,length);

        // Implement specific scaling logic here (e.g., CPU/memory usage, request rate, etc.)

        return currentInstances.length < maxInstances; // No scaling needed
    }

    function getServiceFromRequest(request){

        let serviceInManifest = null;
        if(request.url.startsWith("/api/")){
            serviceInManifest = manifest.services[manifest.ServiceIds.ALKIMIA_BACKEND];
        }
        else{
            serviceInManifest = Object.values(manifest.services).find(service=>service.config.public_domain === request.headers.host);
        }

        if(!serviceInManifest){
            Console.error("service manifest not found for request.url", request.url);
            return null;
        }

        return serviceInManifest;

    }

    instance.getServiceFromRequest = getServiceFromRequest;
    instance.checkScalingCondition = checkScalingCondition;


    return _init();
}

let _singleton = null;
ServiceDispatcher.getSingleton = function(_params){
    if(_singleton === null){
        _singleton = ServiceDispatcher(_params);
    }
    return _singleton;
};


