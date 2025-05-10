import {utilities as Utilities} from "@alkimia/lib";
import Console from "@intersides/console";


export default function ServiceDispatcher(_args=null){
    const instance = Object.create(ServiceDispatcher.prototype, {});

    const { manifest } = Utilities.transfer(_args, {
        manifest:null
    });

    // const _routingRules = [
    //     {
    //         // Route based on path
    //         match: (req) => req.url.startsWith("/api/"),
    //         target: {
    //             type:"app",
    //             location:"apps/backend",
    //             service: "alkimia-backend",
    //             name: "backend",
    //             host: "localhost",
    //             port: 8080
    //         }
    //     },
    //     {
    //         // Route based on hostname
    //         match: (req) => req.headers.host === "app.alkimia.localhost",
    //         target: {
    //             type:"app",
    //             location:"apps/frontend",
    //             service: "alkimia-frontend",
    //             name: "frontend",
    //             host: "localhost",
    //             port: 7070
    //         }
    //     },
    //     {
    //         // Route based on hostname
    //         match: (req) => req.headers.host === "server.alkimia.localhost",
    //         target: {
    //             type:"app",
    //             location:"apps/backend",
    //             service: "alkimia-backend",
    //             name: "backend",
    //             host: "localhost",
    //             port: 8080
    //         }
    //     },
    //     {
    //         // Route based on hostname
    //         match: (req) => req.headers.host === "mqtt.alkimia.localhost",
    //         target: {
    //             type:"service",
    //             service: "mqtt-alkimia-broker",
    //             name: "mqtt",
    //             host: "localhost",
    //             port: 9001
    //         }
    //     }
    //
    //     // {
    //     //     // Route based on HTTP method
    //     //     match: (req) => req.method === 'POST',
    //     //     target: { host: 'localhost', port: 7071 }
    //     // },
    //     // {
    //     //     // Default route
    //     //     match: () => true,
    //     //     target: { host: 'localhost', port: 7070 }
    //     // }
    // ];

    function _init(){
        Console.log("manifest:", manifest);
        return instance;
    }

    // instance.routingRules = _routingRules;
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


