import Utilities from "@alkimia/lib/src/Utilities.js";
import {MongoClient,  Collection} from "mongodb";
import Console from "@intersides/console";
import DockerManager from "../DockerManager.js";

/**
 *
 * @param { Object } _args
 * @return {*}
 * @constructor
 */
export default function MongoDbService(_args=null){

    let instance = Object.create(MongoDbService.prototype, {});

    const {uri, dbName} = Utilities.transfer(_args, {
        uri:null,
        dbName:null
    });

    let mongoClient = null,
        db = null;

    /**
     * MongoDb Collections (tables)
     * @type { Collection<Document>|null }
     */
    let services = null,
        monitors = null,
        events = null;

    function _init(){
        Console.debug("mongoDbUrl", uri);

        mongoClient = new MongoClient(uri, {
            connectTimeoutMS: 3000,
            serverSelectionTimeoutMS:3000,
            socketTimeoutMS: 45000
        });
        mongoClient.connect().then( async function(client){
            Console.log("db connected to", uri);
            if(Utilities.isNonemptyString(dbName)){
                db = client.db(dbName);
                Console.log(`${dbName} database has been set`);

                services = db.collection("services");
                events = db.collection("events");
                monitors = db.collection("monitors");

                const eventsChangeStream = events.watch();
                eventsChangeStream.on("change", (change)=>{
                    Console.warn("on change event triggered by the EVENTS collection", change);
                });


            }
            else{
                throw Error("DatabaseService requires a name string as parameter");
            }
        }).catch(connectionError=>{
            Console.error(connectionError);
        });

        _registerEvents();

        return instance;
    }

    function _registerEvents(){
        DockerManager.on("container-created", function(containerInfo){
            Console.log("onEvent Container has created", containerInfo);

            upsertServiceState(containerInfo);
        });

        DockerManager.on("container-started", function(containerInfo){
            Console.info("onEvent Container has started", containerInfo);
            upsertServiceState(containerInfo);
        });

        DockerManager.on("running", function(containerInfo){
            Console.info(`onEvent Container ${containerInfo.name} running`);
            upsertServiceState(containerInfo);
        });

        DockerManager.on("stopped", function(containerInfo){
            Console.warn(`onEvent Container ${containerInfo.name} stopped`);
            upsertServiceState(containerInfo);
        });
        DockerManager.on("error", function(containerInfo){
            Console.error(`onEvent Container ${containerInfo.name} error`);
            upsertServiceState(containerInfo);
        });
        DockerManager.on("container-stopped", function(containerInfo){
            Console.warn(`onEvent Container ${containerInfo.name} stopped`);
            upsertServiceState(containerInfo);
        });
        DockerManager.on("container-died", function(containerInfo){
            Console.warn(`onEvent Container ${containerInfo.name} died`);
            upsertServiceState(containerInfo);
        });
        DockerManager.on("container-destroyed", function(containerInfo){
            Console.error(`onEvent Container ${containerInfo.name} destroy`);
            upsertServiceState(containerInfo);
        });

        DockerManager.on("not_exists", function(containerInfo){
            Console.error(`onEvent Container not_exists ${containerInfo.name}`);
        });

        DockerManager.on("event", function(event){
            Console.error("onEvent Container event:", event);
            switch(event.type){
                case "docker-container":{
                    _storeEvent(event.type, event);
                }break;
                default:{
                    Console.warn("not dealing with event type :", event.type);
                }break;
            }
        });

    }


    function upsertServiceState(serviceState){
        if(services){
            services.findOneAndUpdate(
                { name: serviceState.name }, // Filter: Match by 'container'
                { $set: serviceState },                // Update: Set the full 'data' object
                {
                    upsert: true,
                    returnDocument: "after"
                }               // Insert the document if it doesn't exist
            ).then((result) => {
                Console.log("Upsert result:", result);
            }).catch((err) => {
                Console.error("Failed to perform upsert operation:", err);
            });

        }
        else{
            Console.warn("collection services is not ready");
        }
    }

    async function _getEvent(_eventType, _filter){
        if(events){

            return await events.findOne({type:_eventType, ..._filter});


            // if ((await events.countDocuments(_filter)) > 0) {
            //
            //     const cursor = events.find(_filter);//.sort(sortFields).project(projectFields);
            //     for await (const doc of cursor) {
            //         Console.log("doc:", doc);
            //     }
            //
            // } else {
            //     console.log("No documents found!");
            // }

            // events.find(
            //     { type: _eventType, ..._filter }
            // ).then((result) => {
            //     Console.log("inserted event:", result);
            // }).catch((err) => {
            //     Console.error("Failed to perform insert operation:", err);
            // });

        }
        else{
            Console.warn("collection events is not ready");
            return null;
        }
    }

    function _upsertMonitoringEvent(readingData){
        if(monitors){
            monitors.findOneAndUpdate(
                { name: readingData.name }, // Filter: Match by 'container'
                { $set: readingData },                // Update: Set the full 'data' object
                {
                    upsert: true,
                    returnDocument: "after"
                }               // Insert the document if it doesn't exist
            ).then((result) => {
                Console.log("Upsert result:", result);
            }).catch((err) => {
                Console.error("Failed to perform upsert operation:", err);
            });

        }
        else{
            Console.warn("collection monitors is not ready");
        }
    }


    function _storeEvent(_eventType, eventData){
        if(events){
            events.insertOne(
                { type: _eventType, ...eventData },
                {}
            ).then((result) => {
                Console.log("inserted event:", result);
            }).catch((err) => {
                Console.error("Failed to perform insert operation:", err);
            });

        }
        else{
            Console.warn("collection events is not ready");
        }
    }

    instance.getEvent = _getEvent;
    instance.storeEvent = _storeEvent;
    instance.upsertServiceState = upsertServiceState;
    instance.upsertMonitoringEvent = _upsertMonitoringEvent;

    return _init();
}

let singleton = null;
MongoDbService.getSingleton = function(_args=null){
    if(!singleton){
        singleton = MongoDbService(_args);
    }
    return singleton;
};
