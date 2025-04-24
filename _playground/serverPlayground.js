import Server from "@workspace/node/services/Server.js";
import Router from "@workspace/node/services/Router.js";
import { HttpResponse } from "@workspace/node/httpLib.js";
import {MimeType} from "@workspace/common/enums.js";

let server = Server.getInstance({
    port:7171,
    router : Router.getInstance({
        routes: {
            GET: {
                "/": {
                    isProtected: false,
                    handler: ()=>HttpResponse({msg:"hello"}, MimeType.JSON)
                }
            }
        }
    })
});

