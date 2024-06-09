const express = require("express");
const indexRouter = express.Router();
const fastcurateRouter = require("./fastcurate");
const authRouter = require("./auth");
const banlistRouter = require("./banlist");

/* GET home page. */
indexRouter.get("/", function (req, res, next) {
    return res.send({ title: "Fastcurate backend" });
});

indexRouter.post("/", function (req, res, next) {
    return res.send({ title: "Fastcurate backend" });
});

const routers = [
    {
        path: "/",
        handler: indexRouter
    },
    {
        path: "/fastcurate",
        handler: fastcurateRouter,
    },
    {
        path: "/auth",
        handler: authRouter,
    },
    {
        path: "/banlist",
        handler: banlistRouter,
    },
]

module.exports = routers;
