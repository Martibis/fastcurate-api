require("dotenv").config();
const pool = require("../helpers/connection");
const { Client } = require('@hiveio/dhive');
const client = new Client(["https://api.hive.blog", "https://anyx.io", "https://api.openhive.network"]);
const steem = require('steem');
const sanitize = require("xss");
const utils = require("../helpers/utils");
const { v4: uuidv4 } = require('uuid');
const encryptionHelper = require("../helpers/encryptionhelper.js");

module.exports = {
    fetchMemo: async (req, res, next) => {
        const username = sanitize(req.body.username);
        if (username && username.length < 16 && username.length > 3) {
            let data = await client.database.getAccounts([username]);
            let pub_key = data[0].posting.key_auths[0][0];
    
            if (data.length === 1)
            {
                let user = await pool.query("SELECT * from user_login where username = ?", [username]);
                let encoded_message = "";
                if (user.length === 0) {
                    let nonce = uuidv4();
                    let {encrypted, iv} = await utils.encrypt(username+'@'+nonce);
    
                    encrypted = "#"+encrypted;
                    console.log(process.env.WIF, pub_key, encrypted);
    
                    encoded_message = steem.memo.encode(process.env.WIF, pub_key, encrypted);
    
                    await pool.query("INSERT INTO user_login(username, encrypted_username, iv, token, nonce) VALUES(?,?,?,?,?)", [username, encrypted, iv, '', nonce]);
                    return res.status(200).json({ message : encoded_message })
                } else
                {
                    // We recalculate each time in case the user has changed it's keys
                    encoded_message = steem.memo.encode(process.env.WIF, pub_key, user[0].encrypted_username);
                    return res.status(200).json({ message : encoded_message })
                }
    
            } else
            {
                return res.status(400);
            }
        }
    },
    login: async (req, res, next) => {
        const username = sanitize(req.body.username);
        let encrypted_username = sanitize(req.body.encrypted_username);
        if (username && encrypted_username && username.length < 16 && username.length > 3) {
    
            let user = await pool.query("SELECT * from user_login where username = ?", [username]);
            if (user.length === 1 && user[0].encrypted_username === encrypted_username)
            {
                // Remove leading #
                encrypted_username = encrypted_username.substr(1);
                let username_decrypted = await utils.decrypt(encrypted_username, user[0].iv);
    
                if (username_decrypted.split('@')[0] === username && user[0].nonce === username_decrypted.split('@')[1]) {
    
                    let data = await pool.query("SELECT * FROM user_data WHERE username = ?", [username]);
    
                    if (data.length === 0) {
                        await pool.query("INSERT INTO user_data(username) VALUES(?)", [username]);
                        data = await pool.query("SELECT * FROM user_data WHERE username = ?", [username]);
                    }

                    const tokenData = data[0];
                    console.log(tokenData);
                    let token = await utils.generateAndInsertTokens({
                        id: tokenData.id,
                        username: tokenData.username
                    });
                    let account = {
                        username,
                        token: token.accessToken
                    };
                    return res.status(200).json(account);
                }
            }
    
            return res.status(400);
        }
    },
    verifyToken: async (req, res, next) => {
        return res.status(200).json({data: req.tokenData});
    },
    updateIntro: (req, res, next) => {
        const applicationQuery = "UPDATE user_data SET intro = ? WHERE id = ?";
        pool.query(applicationQuery, [req.body.intro, req.tokenData.id], (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                return res.json(selectrows);
            }
        });
    },
}