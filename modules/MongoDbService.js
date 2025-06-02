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

    let onConnected = function(){
        throw new Error("method onConnected must be delegated");
    };

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
            if(Utilities.isNonemptyString(dbName)){
                db = client.db(dbName);
                Console.log(`${dbName} database has been set`);

                services = db.collection("services");
                events = db.collection("events-services");
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

        DockerManager.on("docker-update-event", function(eventData){
            Console.log(`onEvent 'docker-update-event' from container ${eventData.instance_name} :${eventData.state}`, eventData);
        });

        DockerManager.on("event", function(event){
            Console.debug(`onEvent '${event.type}' from container event:`, event);
            switch(event.type){
                case "docker-container":{
                    storeEvent(event.type, event);

                    switch(event.state ){
                        case "kill":
                        case "die":
                        case "destroy":{
                            services.findOneAndDelete({instance_id: event.data.container_id})
                                .catch(exc=>{
                                    Console.error(exc);
                                });
                        }break;

                        default:{
                            Console.debug(`event state:${event.state} not considered`);
                        }
                    }


                }break;
                default:{
                    Console.warn("not dealing with event type :", event.type);
                }break;
            }
        });

    }

    function upsertService(serviceInfo){
        if(services){
            services.findOneAndUpdate(
                { container_id: serviceInfo.container_id }, // Filter: Match by 'container'
                { $set: serviceInfo },                // Update: Set the full 'data' object
                {
                    upsert: true,
                    returnDocument: "after"
                }               // Insert the document if it doesn't exist
            ).catch((err) => {
                Console.error("Failed to perform upsert operation:", err);
            });
        }
        else{
            Console.warn("collection services is not ready");
        }
    }


    function removeAllServices(){
        // Delete all documents where instance_id is in the provided array
        return services.deleteMany({});
    }

    function removeContainerById(containerId){
        // Delete all documents where instance_id is in the provided array
        Console.debug("DEBUG: about to delete entry with containerId", containerId);
        services.deleteOne({
            instance_id: containerId
        }).then(result=>{
            Console.debug("deleteContainersById result", result);
        }).catch(exc=>{
            Console.error(exc);
        });
    }

    function getAllContainers(){
        return services.find().toArray();
    }

    async function getEvent(_eventType, _filter){
        if(events){
            return await events.findOne({type:_eventType, ..._filter});
        }
        else{
            Console.warn("collection events is not ready");
            return null;
        }
    }

    function upsertMonitoringEvent(readingData){
        if(monitors){
            monitors.findOneAndUpdate(
                { name: readingData.name }, // Filter: Match by 'container'
                { $set: readingData },                // Update: Set the full 'data' object
                {
                    upsert: true,
                    returnDocument: "after"
                }               // Insert the document if it doesn't exist
            ).then((result) => {
                // Console.log("Upsert result:", result);
                Console.info(`stored monitoring data: container:${result["container"]} cpu%:${result["cpuPercent"]}, in panic ${result["panic"]}`);
            }).catch((err) => {
                Console.error("Failed to perform upsert operation:", err);
            });

        }
        else{
            Console.warn("collection monitors is not ready");
        }
    }


    function storeEvent(_eventType, eventData){
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

    instance.getEvent = getEvent;
    instance.storeEvent = storeEvent;
    instance.upsertService = upsertService;
    instance.upsertMonitoringEvent = upsertMonitoringEvent;
    instance.getAllContainers = getAllContainers;
    instance.removeContainerById = removeContainerById;
    instance.removeAllServices = removeAllServices;
    instance.mongoClient = mongoClient;

    instance.onConnected = function(_delegate){
        if(typeof _delegate === "function"){
            onConnected = _delegate;
        }
    };

    return _init();
}

let singleton = null;
MongoDbService.getSingleton = function(_args=null){
    if(!singleton){
        singleton = MongoDbService(_args);
    }
    return singleton;
};
