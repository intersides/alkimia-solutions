import {describe, test, expect, it} from "vitest";
import ContainerMonitorService from "../modules/ContainerMonitorService.js";
import Console from "@intersides/console";

let containersStatesHistory = {
    "alkimia-backend-684746bdcf3e2bd9e03cb00f": [
        {
            "status": "healthy",
            "cpuUsage": 0.24,
            "time": "2025-06-09T20:47:39.072Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.55,
            "time": "2025-06-09T20:47:44.140Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.44,
            "time": "2025-06-09T20:47:49.191Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.99,
            "time": "2025-06-09T20:47:54.332Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.91,
            "time": "2025-06-09T20:47:59.436Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.35,
            "time": "2025-06-09T20:48:04.420Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.38,
            "time": "2025-06-09T20:48:09.503Z"
        }
    ],
    "alkimia-backend-68462a6a9f204d7af2a8aaf6": [
        {
            "status": "healthy",
            "cpuUsage": 0.76,
            "time": "2025-06-09T20:47:39.162Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.33,
            "time": "2025-06-09T20:47:44.207Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.61,
            "time": "2025-06-09T20:47:49.254Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.6,
            "time": "2025-06-09T20:47:54.264Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.54,
            "time": "2025-06-09T20:47:59.354Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.36,
            "time": "2025-06-09T20:48:04.521Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.36,
            "time": "2025-06-09T20:48:09.588Z"
        }
    ],
    "alkimia-dashboard-684629be236b944a402e7223": [
        {
            "status": "healthy",
            "cpuUsage": 1.25,
            "time": "2025-06-09T20:47:40.087Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.3,
            "time": "2025-06-09T20:47:45.202Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.47,
            "time": "2025-06-09T20:47:50.208Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.02,
            "time": "2025-06-09T20:47:55.291Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.31,
            "time": "2025-06-09T20:48:00.368Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.04,
            "time": "2025-06-09T20:48:05.430Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.85,
            "time": "2025-06-09T20:48:10.639Z"
        }
    ],
    "alkimia-backend-684629e4236b944a402e722a": [
        {
            "status": "healthy",
            "cpuUsage": 0.54,
            "time": "2025-06-09T20:47:40.088Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.42,
            "time": "2025-06-09T20:47:45.140Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.36,
            "time": "2025-06-09T20:47:50.209Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.39,
            "time": "2025-06-09T20:47:55.292Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.33,
            "time": "2025-06-09T20:48:00.370Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 0.31,
            "time": "2025-06-09T20:48:05.431Z"
        }
    ],
    "alkimia-stress-agent-68462a409f204d7af2a8aadd": [
        {
            "status": "healthy",
            "cpuUsage": 1.73,
            "time": "2025-06-09T20:47:40.139Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.03,
            "time": "2025-06-09T20:47:45.203Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.08,
            "time": "2025-06-09T20:47:50.269Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.05,
            "time": "2025-06-09T20:47:55.377Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.21,
            "time": "2025-06-09T20:48:00.450Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.06,
            "time": "2025-06-09T20:48:05.429Z"
        },
        {
            "status": "healthy",
            "cpuUsage": 1.44,
            "time": "2025-06-09T20:48:10.637Z"
        }
    ]
};




describe(ContainerMonitorService.constructor.name, function(){
    describe("constructor", function(){
        test("has a constructor reflecting the expected type", function(){
            expect(ContainerMonitorService().constructor).toBe(ContainerMonitorService);
        });
    });

    describe("haveAllContainersSettledInStatus", function(){

        test("test that are all in panic", function(){


            let allInPanic = ContainerMonitorService().haveAllContainersSettledInStatus("alkimia-backend", "panic", 3,
                {
                    "alkimia-backend":
                        {
                            "alkimia-backend-684746bdcf3e2bd9e03cb00f": [
                                {
                                    "status": "healthy"
                                },
                                {
                                    "status": "panic"
                                },
                                {
                                    "status": "panic"
                                },
                                {
                                    "status": "healthy"
                                },
                                {
                                    "status": "panic"
                                },
                                {
                                    "status": "panic"
                                },
                                {
                                    "status": "panic"
                                }
                            ],
                            "alkimia-backend-68462a6a9f204d7af2a8aaf6": [
                                {
                                    "status": "healthy"
                                },
                                {
                                    "status": "healthy"
                                },
                                {
                                    "status": "healthy"
                                },
                                {
                                    "status": "healthy"
                                },
                                {
                                    "status": "panic"
                                },
                                {
                                    "status": "panic"
                                },
                                {
                                    "status": "panic"
                                }
                            ]
                        }
                });
            expect(allInPanic).to.toBe(true);
        });

        test("test that are all healthy", function(){

            let allInPanic = ContainerMonitorService().haveAllContainersSettledInStatus("alkimia-backend", "healthy", 3,
                {
                    "alkimia-backend":{
                        "alkimia-backend-684746bdcf3e2bd9e03cb00f": [
                            {
                                "status": "panic"
                            },
                            {
                                "status": "panic"
                            },
                            {
                                "status": "panic"
                            },
                            {
                                "status": "panic"
                            },
                            {
                                "status": "healthy"
                            },
                            {
                                "status": "healthy"
                            },
                            {
                                "status": "healthy"
                            }
                        ],
                        "alkimia-backend-68462a6a9f204d7af2a8aaf6": [
                            {
                                "status": "panic"
                            },
                            {
                                "status": "panic"
                            },
                            {
                                "status": "panic"
                            },
                            {
                                "status": "panic"
                            },
                            {
                                "status": "healthy"
                            },
                            {
                                "status": "healthy"
                            },
                            {
                                "status": "healthy"
                            }
                        ]
                    }
                });
            expect(allInPanic).to.toBe(true);
        });
    });


});

