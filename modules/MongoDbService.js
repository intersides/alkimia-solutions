import Utilities from "@alkimia/lib/src/Utilities.js";
import {MongoClient,  Collection} from "mongodb";
import Console from "@intersides/console";

/**
 *
 * @param { Object } _args
 * @return {*}
 * @constructor
 */
export default function MongoDbService(_args=null){

    let instance = Object.create(MongoDbService.prototype, {});

    const {} = Utilities.transfer(_args, {});


    let mongoClient = null,
        db = null;

    /**
     * MongoDb Collections (tables)
     * @type { Collection<Document>|null }
     */
    let services = null,
        events = null;

    function _init(){
        Console.debug("mongoDbUrl", MongoDbService.envVars.uri);

        mongoClient = new MongoClient(MongoDbService.envVars.uri, {
            connectTimeoutMS: 3000,
            serverSelectionTimeoutMS:3000,
            socketTimeoutMS: 45000
        });
        mongoClient.connect().then( async function(client){
            Console.log("db connected to", MongoDbService.envVars.uri);
            if(Utilities.isNonemptyString(MongoDbService.envVars.dbName)){
                db = client.db(MongoDbService.envVars.dbName);
                Console.log(`${MongoDbService.envVars.dbName} database has been set`);

                services = db.collection("services");
                events = db.collection("events");
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

        return instance;
    }

    function upsertServiceState(serviceState){
        if(services){
            services.findOneAndUpdate(
                { container: serviceState.container }, // Filter: Match by 'container'
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

    function _storeEvent(_eventType, eventData){
        if(events){
            events.insertOne(
                { type: _eventType, ...eventData },
                {

                }
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

    return _init();
}

let singleton = null;
MongoDbService.getSingleton = function(_args=null){
    if(!singleton){
        singleton = MongoDbService(_args);
    }
    return singleton;
};

MongoDbService.envVars = {
    url:null,
    dbName:null
};
