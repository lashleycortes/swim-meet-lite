# SwimMeet Lite architecture

```text
Developer --git push--> GitHub --webhook / SCM polling--> Jenkins
                                                        |
                                           Checkout -> Test -> Build
                                                        |
                                               Deploy -> Smoke Test

Browser --> Nginx proxy :8080
              |-- / ----------------> frontend :80
              |-- /api/swimmers/ ---> swimmer-api :3000 --+
              |-- /api/meets/ ------> meet-api :3001 -----+--> PostgreSQL :5432
                                                           named volume
```

Only the Nginx proxy publishes an application port on the host. PostgreSQL is not published. `swimmeet-net` carries frontend/API/proxy traffic, while `data-net` is internal and connects the APIs to the database.
