import {HttpResponse} from "@workspace/node/ServerResponse.js";
import {MimeType} from "@workspace/common/enums.js";
import Console from "@intersides/console";
import {utilities} from "@alkimia/lib";

export default function ProxyRouter(_args){
    let instance = Object.create(ProxyRouter.prototype, {});

    let { dockerManager } = utilities.transfer(_args, {
        dockerManager:null
    });

    if(!dockerManager){
        throw Error("DockerManager parameter is required");
    }

    instance.handle = function handle(url){

        let buffer = url.split("/");
        let method = buffer[buffer.length-1];

        let proxyHttpResponse = null;
        switch(method){
            case "getServices":{
                let allContainers = dockerManager.getContainersByFilter("alkimia-workspace", "namespace");

                proxyHttpResponse = HttpResponse({
                    data: {
                        services: allContainers.map( (containerInfo)=>{
                            Console.debug("containerInfo", containerInfo);
                            return {
                                id:containerInfo.ID,
                                image:containerInfo.Image,
                                name:containerInfo.Names,
                                status:containerInfo.Status,
                                state:containerInfo.State
                            };
                        })
                    },
                    mimeType: MimeType.JSON
                });
            }break;

            default:{
                Console.warn("NULL will be returned because the proxy is not handling requested url:", url);
            }break;
        }

        return proxyHttpResponse;

    };

    return instance;
}
