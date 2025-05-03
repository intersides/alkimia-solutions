"use strict";
import {utilities} from "@alkimia/lib";
import fs from "fs";
import {HttpErrorStatus, MimeType} from "@workspace/common/enums.js";
import httpUtils from "@workspace/common/httpUtils.js";
import {HttpError} from "../httpLib.js";
import {HttpResponse} from "../ServerResponse.js";
import Console from "@intersides/console";

// import networkUtils from "../network-utils.js";
// import { HttpError, HttpErrorStatus } from "../../../shared-js/comm/Responses.js";

/**
 * Represents a Router object.
 * @typedef {Object} Router
 * @property {Function} httpRequestListener - Handles incoming HTTP requests.
 * @property {Function} handleRequest - Core method to process requests.
 */

/**
 * Router factory function.
 * @param {Object|null} args - Configuration properties for the router.
 * @param {string|null} [args.instanceId] - Unique identifier for the router instance.
 * @param {Object.<string, Object.<string, Object>>} [args.routes] - Routes configuration.
 *    Keys are HTTP methods (e.g., "GET", "POST") and values are objects mapping paths to handlers.
 * @returns {Router} Router instance.
 */
export default function Router(args){

    /**
     * @type {Router|*}
     */
    const instance = Object.create(Router.prototype);

    const {
        instanceId,
        routes,
        staticDir,
        sharedDir,
        modulesDir
    } = utilities.transfer(args, {
        instanceId: null,
        routes: null,
        staticDir: null,
        sharedDir: null,
        modulesDir: null
    });

    /**
     *
     * @return {Router}
     * @private
     */
    const _initialize = () => {
        _registerEvents();
        return instance;
    };

    function _registerEvents(){
    }

    async function _catchAll(request){
        if (Object.hasOwn(routes, "*") && typeof routes["*"].handler === "function") {
            return new Promise((resolve)=>{
                Promise.resolve(routes["*"].handler(request)).finally(() => resolve());
            });
        }
        return Promise.resolve();

    }

    function _getHandler(_request){
        const path = _request.url.path;
        const method = _request.method.toUpperCase();
        if(
            utilities.isNotNullObject(routes) &&
            utilities.isNotNullObject(routes[method])
        ){
            if(Object.hasOwn(routes[method], path)){
                return routes[method][path].handler;
            }
            else{
                // Console.warn(`handler for ${path} not found for request:`, _request);
                return null;
            }
        }
        else{
            throw `method ${method} not registered`;
        }

    }

    instance.httpRequestListener = async function(req){
        Console.log(req);
    };

    /**
     * Processes the incoming request and determines a response.
     * @param  request - Incoming HTTP request.
     */
    function _handleRequest(request){

        // Console.warn("WARN: request", request);

        return new Promise(function(resolve, reject){

            let assetsDir = staticDir;
            const handler = _getHandler(request);
            if(handler){
                resolve(handler(request));
            }
            else{
                let urlPath = request.url.path.replace(/^\//, "");

                Console.debug("WARN: urlPath:", urlPath);

                if(urlPath.startsWith("node_modules/")){
                    assetsDir = modulesDir;
                    urlPath = urlPath.replace("node_modules/", "");
                }
                else if(urlPath.startsWith("shared/")){
                    assetsDir = sharedDir;
                    urlPath = urlPath.replace("shared/libs/", "");
                }
                let fileName = httpUtils.fileNameFromUrl(request.url.path);
                let staticFileTarget = `${assetsDir}/${urlPath}`;

                fs.readFile(staticFileTarget, (err, data) => {
                    if(err){
                        Console.error("ERROR: handler not found... trying to look for a resource in \n\tstaticFileTarget:", staticFileTarget, "\n\tfileName:", urlPath);
                        return reject(HttpError(HttpErrorStatus.Http404_Not_Found.value, HttpErrorStatus.Http404_Not_Found.code));
                    }

                    let mimeType = MimeType.TEXT;

                    const fileType = fileName.split(".")[1];
                    switch(fileType){

                        case "css":{
                            mimeType = MimeType.CSS;
                        }
                            break;

                        case "cur":
                        case "ico":{
                            mimeType = MimeType.FAVICON;
                        }
                            break;

                        case "bmp":{
                            mimeType = MimeType.BMP;
                        }
                            break;

                        case "png":{
                            mimeType = MimeType.PNG;
                        }
                            break;

                        case "gif":{
                            mimeType = MimeType.GIF;
                        }
                            break;

                        case "svg":{
                            mimeType = MimeType.SVG;
                        }
                            break;

                        case "tiff":
                        case "tif":{
                            mimeType = MimeType.TIFF;
                        }
                            break;

                        case "avif":{
                            mimeType = MimeType.AVIF;
                        }
                            break;
                        case "webp":{
                            mimeType = MimeType.WEBP;
                        }
                            break;

                        case "jfif":
                        case "jif":
                        case "jpe":
                        case "jpeg":
                        case "jpg":{
                            mimeType = MimeType.JPG;
                        }
                            break;

                        case "cjs":
                        case "mjs":
                        case "js":{
                            mimeType = MimeType.JS;
                        }
                            break;

                        default:{
                            mimeType = MimeType.TEXT;
                        }
                    }
                    Console.debug("MimeType of the requested file:", mimeType);

                    const response = HttpResponse({
                        data: data,
                        mimeType
                    });
                    resolve(response);

                });

            }

        });

    }

    instance.handleRequest = _handleRequest;
    instance.catchAll = _catchAll;

    return _initialize();
}

/**
 *
 * @type {Router}
 * @private
 */
let _instance = null;

Router.getSingleton = function(_args = null){
    if(!_instance){
        _instance = Router(_args);
    }
    return _instance;
};

Router.getInstance = function(_args){
    return Router(_args);
};
