import {utilities as Utilities} from "@alkimia/lib";
import Console from "@intersides/console";


export default function ServiceDispatcher(_args=null){
    const instance = Object.create(ServiceDispatcher.prototype, {});



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


