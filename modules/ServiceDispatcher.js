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

    instance.httpRouting = [
        {
            //NOTE: this might be not secure
            match: (req) => {
                return req.url.startsWith("/api/")
                    || req.headers.host === "server.alkimia.localhost";
            },
            target: manifest.services["alkimia-backend"]
        },
        {
            match: (req) => req.headers.host === "app.alkimia.localhost",
            target:manifest.services["alkimia-frontend"]
        }

    ];
    instance.wssRouting = [
        {
            match: (req) => req.headers.host === "mqtt.alkimia.localhost",
            target:manifest.services["mqtt-alkimia-broker"]

        }
    ];


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


