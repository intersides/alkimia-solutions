import {utilities as Utilities} from "@alkimia/lib";
import Console from "@intersides/console";

/**
 *
 * @param _args
 * @return {*}
 * @constructor
 */
export default function ServiceDispatcher(_args=null){
    let instance = Object.create(ServiceDispatcher.prototype, {});

    const { manifest } = Utilities.transfer(_args, {
        manifest:null
    });

    function _init(){
        Console.log("manifest:", manifest);
        return instance;
    }

    instance.getService = function(_serviceName){
        return manifest.services[_serviceName];
    };

    instance.httpManifestService = function(request){

        let httpServices = Object.values(manifest.services).filter(service=>service.protocol === "http");

        let serviceInManifest = null;
        switch(request.url){
            case request.url.startsWith("/api/") ||  request.headers.host === "server.alkimia.localhost":{
                serviceInManifest = manifest.services["alkimia-backend"];
            }break;

            default:{
                serviceInManifest = httpServices.find(service=>service.config.public_domain === request.headers.host);
            }break;
        }

        if(!serviceInManifest){
            Console.error("service manifest not found for request.url", request.url);
            return null;
        }

        return serviceInManifest;

    };

    instance.socketManifestService = function(request){

        let socketServices = Object.values(manifest.services).filter(service=>service.protocol === "mqtt" || service.protocol === "ws" || service.protocol === "wss");

        let serviceInManifest = null;
        switch(request.url){
            default:{
                serviceInManifest = socketServices.find(service=>service.config.public_domain === request.headers.host);
            }break;
        }

        if(!serviceInManifest){
            Console.error("service manifest not found for request.url", request.url);
            return null;
        }


        return serviceInManifest;

    };


    return _init();
}

let _singleton = null;
ServiceDispatcher.getSingleton = function(_params){
    if(_singleton === null){
        _singleton = ServiceDispatcher(_params);
    }
    return _singleton;
};

ServiceDispatcher.ServiceId = {
    MONGO_DB:"mongodb-alkimia-storage",
    MQTT_BROKER:"mqtt-alkimia-broker",
    LOAD_BALANCER:"alkimia-load-balancer"
};


