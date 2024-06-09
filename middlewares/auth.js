const jwt = require('jsonwebtoken')
const pool = require("../helpers/connection");

async function auth(req, res, next) {
    const authHeader = req.headers['authorization']
    if (authHeader == null) return res.sendStatus(401)
    jwt.verify(authHeader, process.env.ACCESS_TOKEN_SECRET, async (err, tokenData) => {
        if (err) {
            return res.sendStatus(403)
        }
        if(tokenData.username){
            const data = await pool.query("SELECT * FROM user_data WHERE username = ?", [tokenData.username]);
            console.log(data);
            if(data[0] && data[0].is_admin){
                req.tokenData = tokenData
                return next()
            }else{
                return res.sendStatus(403)
            }
        }else
            return res.sendStatus(403)
    })
}

module.exports = auth
