export default {

    services:{
        "alkimia-backend":{
            name: "alkimia-backend",
            monitored:true,
            type:"docker-service",
            protocol: "http",
            mode: "rest-api",
            config:{
                host: "localhost",
                location:"apps/backend",
                public_domain:"server.alkimia.localhost",
                container_name:"alkimia-backend",
                external_port:8080,
                internal_port:3000
            }
        },
        "alkimia-frontend":{
            name: "alkimia-frontend",
            monitored:true,
            type:"docker-service",
            protocol: "http",
            mode: "rest-api",
            config:{
                host: "localhost", //NOTE: important for proxy when running locally
                location:"apps/frontend",
                public_domain:"app.alkimia.localhost",
                container_name:"alkimia-frontend",
                external_port:7070,
                internal_port:3000
            }
        },
        "mqtt-alkimia-broker":{
            name: "mqtt-alkimia-broker",
            monitored:false,
            type:"docker-service",
            protocol: "mqtt",
            mode: "message-broker", // or "pubsub"
            config:{
                host: "localhost",
                container_name:"mqtt-alkimia-broker",
                public_domain:"mqtt.alkimia.localhost",
                image:"eclipse-mosquitto:latest",
                external_port:9001,
                internal_port:1883
            }
        },
        "thingy-sensor": {
            name: "thingy-sensor",
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
