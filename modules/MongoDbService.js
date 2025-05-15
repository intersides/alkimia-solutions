import Utilities from "@alkimia/lib/src/Utilities.js";
import {MongoClient} from "mongodb";
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

    let sessions = null;
    let services = null;

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

                sessions = db.collection("sessions");
                await sessions.createIndex({ session: 1 }, { unique: true });

                services = db.collection("services");
                await services.createIndex({ name: 1 }, { unique: true });


            }
            else{
                throw Error("DatabaseService requires a name string as parameter");
            }
        }).catch(connectionError=>{
            Console.error(connectionError);
        });

        return instance;
    }

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
