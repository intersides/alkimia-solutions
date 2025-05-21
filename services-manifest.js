export default {

    services:{
        "alkimia-backend":{
            name: "alkimia-backend",
            type:"docker",
            monitored:true,
            host: "localhost",
            location:"apps/backend",
            port: 8080,
            config:{
                subdomain:"server",
                container_name:"alkimia-backend",
                internal_port:3000
            }
        },
        "alkimia-frontend":{
            name: "alkimia-frontend",
            type:"docker",
            monitored:true,
            host: "localhost",
            location:"apps/frontend",
            port: 7070,
            config:{
                subdomain:"app",
                container_name:"alkimia-frontend",
                internal_port:3000
            }
        },
        "mqtt-alkimia-broker":{
            name: "mqtt-alkimia-broker",
            type:"docker",
            monitored:false,
            host: "localhost",
            port: 9001,
            config:{
                container_name:"mqtt-alkimia-broker",
                image:"eclipse-mosquitto:latest",
                internal_port:1883
            }
        }
    }
};
