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

    instance.httpRouting = manifest?.httpRouting;
    instance.wssRouting = manifest?.wssRouting;

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


