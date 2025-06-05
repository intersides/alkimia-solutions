import Utilities from "@alkimia/lib/src/Utilities.js";

export default function Manifest(args){

    let { root } = Utilities.transfer(args, {
        root:null
    });

    const Networks = {
        ALKIMIA_NET:"alkimia-net"
    };

    const ServiceIds = {
        ALKIMIA_BACKEND:"alkimia-backend",
        ALKIMIA_FRONTEND:"alkimia-frontend",
        ALKIMIA_DASHBOARD:"alkimia-dashboard",
        STRESS_AGENT:"alkimia-stress-agent",
        MONGO_DB:"mongodb-alkimia-storage",
        MQTT_BROKER:"mqtt-alkimia-broker",
        THINGY_SENSOR:"thingy-sensor"
    };

    return {
        ServiceIds,
        Networks,
        services:{
            [ServiceIds.ALKIMIA_BACKEND]:{
                type:"docker-service",
                name: ServiceIds.ALKIMIA_BACKEND,
                monitored:true,
                maxInstances:10,
                protocol: "http",
                mode: "rest-api",
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    location:"apps/backend",
                    dockerfile:"apps/backend/Dockerfile",
                    public_domain:"server.alkimia.localhost",
                    container_name:ServiceIds.ALKIMIA_BACKEND,
                    volumes:[
                        "/app/node_modules",
                        `${root}/apps/backend:/app`,
                        `${root}/libs:/app/libs`
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
                type:"docker-service",
                name: ServiceIds.ALKIMIA_FRONTEND,
                monitored:false,
                maxInstances:1,
                protocol: "http",
                mode: "rest-api",
                config:{
                    host: "localhost", //NOTE: important for proxy when running locally
                    network: Networks.ALKIMIA_NET,
                    location:"apps/frontend",
                    dockerfile:"apps/frontend/Dockerfile",
                    public_domain:"app.alkimia.localhost",
                    container_name: ServiceIds.ALKIMIA_FRONTEND,
                    volumes:[
                        "/app/node_modules",
                        `${root}/apps/frontend:/app`,
                        `${root}/libs:/app/libs`
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
            [ServiceIds.ALKIMIA_DASHBOARD]:{
                type:"docker-service",
                name: ServiceIds.ALKIMIA_DASHBOARD,
                monitored:false,
                maxInstances:1,
                protocol: "http",
                mode: "rest-api",
                config:{
                    host: "localhost", //NOTE: important for proxy when running locally
                    network: Networks.ALKIMIA_NET,
                    location:"apps/dashboard",
                    dockerfile:"apps/dashboard/Dockerfile",
                    public_domain:"dashboard.alkimia.localhost",
                    container_name: ServiceIds.ALKIMIA_DASHBOARD,
                    volumes:[
                        "/app/node_modules",
                        `${root}/apps/dashboard:/app`,
                        `${root}/libs:/app/libs`
                    ],
                    env:{
                        ENV:"staging",
                        PUBLIC_PORT: "6060",
                        PORT: "3000",
                        PROTOCOL: "https",
                        DOMAIN: "alkimia.localhost",
                        SUBDOMAIN: "dashboard"
                    },
                    external_port:6060,
                    internal_port:3000
                }
            },
            [ServiceIds.STRESS_AGENT]:{
                type:"docker-service",
                name: ServiceIds.STRESS_AGENT,
                monitored:false,
                maxInstances:1,
                protocol: "http",
                mode: "rest-api",
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    location:"stress-agent",
                    dockerfile:"stress-agent/Dockerfile",
                    public_domain:"stressagent.alkimia.localhost",
                    container_name:ServiceIds.STRESS_AGENT,
                    ports:[
                        "7777:3000"
                    ],
                    volumes:[
                        "/app/node_modules",
                        `${root}/stress-agent:/app`,
                        `${root}/libs:/app/libs`,
                        `${root}/certs:/app/certs`
                    ],
                    env:{
                        ENV:"staging",
                        PUBLIC_PORT: "7777",
                        PORT: "3000",
                        PROTOCOL: "https",
                        DOMAIN: "alkimia.localhost",
                        SUBDOMAIN: "stressagent"
                    },
                    external_port:7777,
                    internal_port:3000
                }
            },
            [ServiceIds.MQTT_BROKER]:{
                type:"docker-service",
                name: ServiceIds.MQTT_BROKER,
                monitored:false,
                maxInstances:1,
                protocol: "mqtt",
                mode: "message-broker", // or "pubsub"
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    container_name:ServiceIds.MQTT_BROKER,
                    public_domain:"mqtt.alkimia.localhost",
                    image:"eclipse-mosquitto:latest",
                    websocket_port:9001,
                    external_port:1883,
                    internal_port:1883
                }
            },
            [ServiceIds.MONGO_DB]:{
                type:"docker-service",
                name: ServiceIds.MONGO_DB,
                monitored:false,
                maxInstances:1,
                protocol: "mqtt",
                mode: "message-broker", // or "pubsub"
                config:{
                    host: "localhost",
                    network: Networks.ALKIMIA_NET,
                    container_name:ServiceIds.MONGO_DB,
                    image:"mongo:latest",
                    env:{
                        MONGO_INITDB_ROOT_USERNAME:"mongoadmin",
                        MONGO_INITDB_ROOT_PASSWORD:"secret"
                    },
                    volumes:[
                        `${root}/services/mongodb/data:/data/db`,
                        `${root}/services/mongodb/config/mongodb-keyfile:/data/mongodb-keyfile`
                    ],
                    health_check:[
                        `--health-cmd "mongosh --eval 'db.runCommand({ ping: 1 })' --quiet"`,
                        "--health-interval=10s",
                        "--health-timeout=5s",
                        "--health-retries=5",
                        "--health-start-period=30s"
                    ],
                    additional_args : [
                        "--replSet rs0",
                        "--keyFile /data/mongodb-keyfile",
                        "--bind_ip_all"
                    ],
                    external_port:27017,
                    internal_port:27017

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

        }
    };

}


