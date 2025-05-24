
export default function Manifest(){

    const Networks = {
        ALKIMIA_NET:"alkimia-net"
    };

    const ServiceIds = {
        ALKIMIA_BACKEND:"alkimia-backend",
        ALKIMIA_FRONTEND:"alkimia-frontend",
        MONGO_DB:"mongodb-alkimia-storage",
        MQTT_BROKER:"mqtt-alkimia-broker",
        LOAD_BALANCER:"alkimia-load-balancer",
        THINGY_SENSOR:"thingy-sensor"
    };

    return {
        ServiceIds,
        Networks,
        services:{
            [ServiceIds.ALKIMIA_BACKEND]:{
                name: ServiceIds.ALKIMIA_BACKEND,
                monitored:true,
                type:"docker-service",
                protocol: "http",
                mode: "rest-api",
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    location:"apps/backend",
                    public_domain:"server.alkimia.localhost",
                    container_name:ServiceIds.ALKIMIA_BACKEND,
                    ports:[
                        "8080:3000"
                    ],
                    env:{
                        ENV:"staging",
                        PUBLIC_PORT: "8080",
                        PORT: "3000",
                        PROTOCOL: "https",
                        DOMAIN: "alkimia.localhost",
                        SUBDOMAIN: "server"
                    },
                    external_port:8080,
                    internal_port:3000
                }
            },
            [ServiceIds.ALKIMIA_FRONTEND]:{
                name: ServiceIds.ALKIMIA_FRONTEND,
                monitored:true,
                type:"docker-service",
                protocol: "http",
                mode: "rest-api",
                config:{
                    host: "localhost", //NOTE: important for proxy when running locally
                    network: Networks.ALKIMIA_NET,
                    location:"apps/frontend",
                    public_domain:"app.alkimia.localhost",
                    container_name: ServiceIds.ALKIMIA_FRONTEND,
                    ports:[
                        "7070:3000"
                    ],
                    env:{
                        ENV:"staging",
                        PUBLIC_PORT: "7070",
                        PORT: "3000",
                        PROTOCOL: "https",
                        DOMAIN: "alkimia.localhost",
                        SUBDOMAIN: "app"
                    },
                    external_port:7070,
                    internal_port:3000
                }
            },
            [ServiceIds.MQTT_BROKER]:{
                name: ServiceIds.MQTT_BROKER,
                monitored:false,
                type:"docker-service",
                protocol: "mqtt",
                mode: "message-broker", // or "pubsub"
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    container_name:ServiceIds.MQTT_BROKER,
                    public_domain:"mqtt.alkimia.localhost",
                    image:"eclipse-mosquitto:latest",
                    ports:[
                        "9001:1883"
                    ],
                    external_port:9001,
                    internal_port:1883
                }
            },
            [ServiceIds.MONGO_DB]:{
                name: ServiceIds.MONGO_DB,
                monitored:false,
                type:"docker-service",
                protocol: "mqtt",
                mode: "message-broker", // or "pubsub"
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    container_name:ServiceIds.MONGO_DB,
                    image:"mongo:latest",
                    ports:[
                        "27017:27017",
                        "28017:28017"
                    ],
                    env:{
                        MONGO_INITDB_ROOT_USERNAME:"mongoadmin",
                        MONGO_INITDB_ROOT_PASSWORD:"secret"
                    },
                    // volumes:[
                    //     `${dataPath}:/data/db`,
                    //     `${keyFilePath}:/data/mongodb-keyfile`
                    // ],
                    health_check:[
                        "--health-cmd \"mongosh --eval 'db.runCommand({ ping: 1 })' --quie\"",
                        "--health-interval=10s",
                        "--health-timeout=5s",
                        "--health-retries=5",
                        "--health-start-period=30s"
                    ],
                    additional_args : ["--replSet rs0", "--keyFile /data/mongodb-keyfile", "--bind_ip_all"]

                }
            },

            [ServiceIds.THINGY_SENSOR]:{
                name: ServiceIds.THINGY_SENSOR,
                monitored: false,
                type: "peripheral",
                protocol: "ble",
                mode: "advertising", // or "GATT" in the future
                config: {
                    device_id: "thingy52-01",
                    alias: "env-probe",
                    sensor_capabilities: ["temperature", "humidity", "air_quality"],
                    trigger_events: {
                        on_motion: "scale:backend:up",
                        on_idle: "scale:backend:down"
                    }
                }
            }

            // "thingy-sensor": {
            //     name: "thingy-sensor",
            //     monitored: false,
            //     type: "peripheral",
            //     protocol: "ble",
            //     mode: "advertising", // or "GATT" in the future
            //     config: {
            //         device_id: "thingy52-01",
            //         alias: "env-probe",
            //         sensor_capabilities: ["temperature", "humidity", "air_quality"],
            //         trigger_events: {
            //             on_motion: "scale:backend:up",
            //             on_idle: "scale:backend:down"
            //         }
            //     }
            // }
        }
    };

}


