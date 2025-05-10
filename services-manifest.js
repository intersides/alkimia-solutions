export default {

    httpRouting:[
        {
            //NOTE: this might be not secure
            match: (req) => {
                return req.url.startsWith("/api/")
                    || req.headers.host === "server.alkimia.localhost";
            },
            target:{
                name: "backend",
                type:"docker",
                host: "localhost",
                location:"apps/backend",
                port: 8080,
                config:{
                    subdomain:"server",
                    container_name:"alkimia-backend",
                    internal_port:3000
                }
            }
        },
        {
            match: (req) => req.headers.host === "app.alkimia.localhost",
            target:{
                name: "frontend",
                type:"docker",
                host: "localhost",
                location:"apps/frontend",
                port: 7070,
                config:{
                    subdomain:"app",
                    container_name:"alkimia-frontend",
                    internal_port:3000
                }
            }
        }

    ],
    wssRouting:[
        {
            match: (req) => req.headers.host === "mqtt.alkimia.localhost",
            target:{
                name: "mqtt-alkimia-broker",
                type:"docker",
                host: "localhost",
                port: 9001,
                config:{
                    container_name:"mqtt-alkimia-broker",
                    image:"eclipse-mosquitto:latest",
                    internal_port:1883
                }
            }
        }
    ]


};
