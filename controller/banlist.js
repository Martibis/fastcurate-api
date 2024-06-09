require("dotenv").config();
const pool = require("../helpers/connection");

module.exports = {
    addToBanlist: async (req, res, next) => {
        const username = req.body.username;
        const reason = req.body.reason;
        if(username && reason) {
            const doesExist = await pool.query("SELECT username from banlist WHERE username = ?", [username]);
            console.log(doesExist);
            let query = "INSERT INTO banlist(reason, username) VALUES(?,?)";
            if(doesExist && doesExist.length){
                query = "UPDATE banlist SET reason = ? WHERE username = ?"
            }
            console.log(query);
            pool.query(query, [reason, username], async (err, selectrows, fields) => {
                if (err) {
                    return next(err);
                } else {
                    return res.json(selectrows)
                }
            });
        }else{
            res.status(400).json({msg : "username and reason is required!"});
        }
    },
    getBanlist: async (req, res, next) => {
        const banlist = await pool.query("SELECT username, reason from banlist;");
        return res.json(banlist);
    },
    deleteFromBanlist: async (req, res, next) => {
        const username = req.params.username;
        if(username) {
            const doesExist = await pool.query("SELECT username, reason from banlist WHERE username = ?", [username]);
            if(doesExist && doesExist.length){
                const deleteResp = await pool.query("DELETE FROM banlist WHERE username = ?", [username]);
                return res.json(deleteResp)
            }else{
                res.status(404).json({msg : "not found in banlist"});
            }
        }else{
            res.status(400).json({msg : "username is required!"});
        }
    },
}