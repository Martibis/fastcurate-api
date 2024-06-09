const sc2 = require('sc2-sdk');
const pool = require("./connection");
const moment = require('moment');
const encryptionHelper = require("./encryptionhelper.js");
const jwt = require("jsonwebtoken");
const algorithm = encryptionHelper.CIPHERS.AES_256;
const crypto = require("crypto");
const { Client: HiveClient, PrivateKey } = require('@hiveio/dhive');
const showdown = require("showdown");
const { v4: uuidv4 } = require('uuid');
const wordsCounter = require('word-counting');
const { Client: DiscordClient, Intents, MessageEmbed } = require('discord.js');
const discord_client = new DiscordClient({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

discord_client.on('ready', async () => {
    console.log(`Logged in as ${discord_client.user.tag}!`);
});
discord_client.login(process.env.DISCORD_CLIENT_TOKEN); //login bot using token

function valid_login(username, token, type) {
    return new Promise(async resolve => {
        let valid;
        pool.query("SELECT * FROM user_login WHERE username = ? AND token = ?", [username, token], async (err, rows, fields) => {
            if (err) {
                return next(err);
            } else {
                let user = rows;
                valid = user.length === 1;
                const lastLoggedInTime = moment().diff(moment(user[0].updated)) / 1000 / 3600 / 24;
                if (lastLoggedInTime > 7) {
                    await pool.query("DELETE FROM user_login where username = ?", [username])
                    return resolve(false);
                }
                return resolve(valid);
            }
        });
    });
}

function sc_valid(username, access_token) {
    return new Promise(resolve => {

        let api = sc2.Initialize({});

        api.setAccessToken(access_token);

        api.me(function (err, res) {
            if (err)
                return resolve([false, err]);

            if (res.name === username)
                return resolve([true]);

            return resolve([true]);
        });
    });
}

/**
 Encrypts text
 @text - text to encrypt
 @initialisation_vector - (optional) iv if we already have one, otherwise will be generated
 */
function encrypt(text, initialisation_vector) {
    return new Promise(async resolve => {
        let data;
        let iv;
        if (initialisation_vector) {
            data = await get_encryption_data(initialisation_vector);
            iv = initialisation_vector;
        }
        else {
            data = await get_encryption_data();
            let json_iv = JSON.stringify(data['iv']);
            json_iv = JSON.parse(json_iv);

            if (!json_iv.data)
                console.log(json_iv);

            iv = json_iv.data.toString();
        }
        const encText = encryptionHelper.encryptText(algorithm, data.key, data.iv, text, "hex");


        return resolve({ encrypted: encText, iv: iv });
    });
}

/**
 Gets the key and iv for aes encryption
 @iv - (optional) iv if we already have one, otherwise will be generated
 */
function get_encryption_data(iv) {
    return new Promise(async resolve => {
        let encryption_data = await encryptionHelper.getKeyAndIV(process.env.ENCRYPTION_PW);
        if (iv) {
            iv = iv.split(",").map(Number);
            const buf = Buffer.from(iv);
            const vue = new Uint8Array(buf);
            encryption_data['iv'] = vue;
            return resolve(encryption_data);
        }
        else
            return resolve(encryption_data);
    });
}

/**
decryptsEncrypts text
@encText - Encrypted text to decrypt
@initialisation_vector - (optional) iv if we already have one, otherwise will be generated
*/
function decrypt(encText, iv) {
    return new Promise(async resolve => {
        const data = await get_encryption_data(iv);

        const decText = encryptionHelper.decryptText(algorithm, data.key, data.iv, encText, "hex");
        return resolve(decText);
    });
}

async function generateAndInsertTokens(tokenData) {
    const data = await new Promise(async (resolve, reject) => {
        try {
            const accessToken = generateAccessToken(tokenData);
            const refreshToken = jwt.sign(
                tokenData,
                process.env.REFRESH_TOKEN_SECRET
            );
            let hashedToken = crypto
                .createHmac("sha256", process.env.REFRESH_SHA256_SECRET)
                .update(refreshToken)
                .digest("hex");
            const qs =
                "UPDATE user_login set token = ? WHERE username = ?";
            pool.query(
                qs,
                [hashedToken, tokenData.username],
                (err, rows, fields) => {
                    if (err) {
                        reject(e);
                    } else {
                        resolve({
                            accessToken: accessToken,
                        });
                    }
                }
            );
        } catch (e) {
            reject(e);
        }
    });
    return data;
}

//Helpers
function generateAccessToken(tokenData) {
    return jwt.sign(tokenData, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
    });
}

function getPostBody(author, permlink) {
    return new Promise(async resolve => {
        try {
            const client = new HiveClient(["https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"]);
            const data = await client.database.call('get_content', [author, permlink]);
            const converter = new showdown.Converter();
            const body = converter.makeHtml(data.body);
            const wordCount = wordsCounter(body, { isHtml: true }).wordsCount;
            if (body)
                return resolve({ body: body, wordCount: wordCount});
            else
                return resolve(null);
        } catch (err) {
            console.log(err);
            return resolve(null);
        }
    });
}

function formulatePostBody(intro, topThree, honorableMentions) {
    try {
        let completeHtml = `<h2>Introduction </h2><br><p>` 
            + intro +
            `</p><br>All featured posts are visible on the <strong><a href='https://www.pinmapple.com/'>Editors Choice Map</a></strong> and upvoted by <strong>@pinmapple</strong> and our curation trail and potentially <strong>@blocktrades</strong>. For more travel digests check out <strong>#traveldigest</strong>.<br></p><hr><h2>Our winners today 🍍</h2>`;
        for (var i = 0; i < topThree.length; i++) {
            let place = "";
            switch (i) {
                case 0:
                    place = "🥇";
                    break;
                case 1:
                    place = "🥈";
                    break;
                case 2:
                    place = "🥉";
                    break;
            }
            console.log(topThree[i]);
            completeHtml =
                completeHtml +
                "<br><b>" +
                place +
                " <a href='" +
                topThree[i].postLink +
                "'>" +
                topThree[i].postTitle +
                "</a> by @" +
                topThree[i].username +
                "</b><br><br><p>" +
                topThree[i].featuredText +
                "</p><p><b><a href='" +
                "http://www.pinmapple.com/p/" + topThree[i].postPermLink +
                "'>This post on Pinmapple</a></b> - <b><a href='" +
                "http://www.pinmapple.com/@" + topThree[i].username +
                "'>This user on Pinmapple</a></b></p><a href='" +
                topThree[i].postLink +
                "'><img src='" +
                topThree[i].postImageLink +
                "'></a><br><hr>";
        }
        completeHtml = completeHtml + "<h2>Honorable Mentions</h2><ul>";
        for (var i = 0; i < honorableMentions.length; i++) {
            completeHtml =
                completeHtml +
                "<li><a href='" +
                honorableMentions[i].postLink +
                "'>" +
                honorableMentions[i].postInfo +
                "</a> by @" +
                honorableMentions[i].username +
                "</li>";
        }
        completeHtml =
            completeHtml +
            "</ul><hr><br><h2>Support pinmapple and join the <a href='https://peakd.com/c/hive-163772'>Pinmapple community</a></h2>" +
            "<strong>The more support we get, the more we can give back! Want to help?</strong><br><a href='https://peakd.com/wallet'>Delegate to Pinmapple!</a><br><a href='https://hive.vote/dash.php?i=1&trail=pinmapple'>Follow our curation trail</a><br> <a href='https://hive.vote/dash.php?fan=pinmapple&i=2'>Upvote the Traveldigest</a> <br><br>" +
            // "<strong>Did you know we made an awesome mobile application for the travel community?</strong><br><a href='https://haveyoubeenhere.com'>Join over 400 travelers there!</a><br>You can use it to post directly to Hive and Pinmapple!<br><br>" +
            "<strong>Want to know more about what we're up to next?</strong><br><a href='https://discord.gg/EGtBvSM'>Join our Discord</a><br>" +
            "<a href='https://twitter.com/hybhere'>Follow us on Twitter</a><br><br>" 
            // +"<strong>Want to learn a bit more about our projects?</strong><br><a href='https://peakd.com/hive/@pinmapple/pinmapple-and-haveyoubeenhere'>Learn more about Pinmapple</a><br><a href='https://www.haveyoubeenhere.com'>Learn more about Haveyoubeenhere</a><br><a href='https://haveyoubeenhere.com'><img src='https://images.ecency.com/0x0/https://files.peakd.com/file/peakd-hive/pinmapple/fsHjnWG6-haveyoubeenhere.png'/></a><a href='http://www.pinmapple.com'><img src='https://pinmapple.com/pinmapple-with-text.png'></a>";
        return { success: true, data: completeHtml };
    } catch (err) {
        console.log(err);
        return { success: false, error: err };
    }
}

async function postTravelDigest(completeHtml, title, digestPermlink) {
    try {
        const data = await new Promise(async (resolve, reject) => {
            const privateKey = PrivateKey.fromString(
                process.env.HIVE_POSTING_KEY
            );
            const commentPayload = {
                parent_author: '',
                parent_permlink: 'hive-163772',
                category: "hive-163772",
                author: process.env.HIVE_USERNAME,
                body: completeHtml,
                json_metadata: JSON.stringify({ tags: ["hive-163772", "traveldigest", "travel", "haveyoubeenhere", "pinmapple", "bmbupdate", "community"] }),
                permlink: digestPermlink, //.replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase(),
                title: title
            }
            console.log(commentPayload);
            const client = new HiveClient(["https://anyx.io"]);
            client.broadcast
            .comment(
                commentPayload,
                privateKey
            )
            .then(
                function (result) {
                    resolve({ success: true, data: result });
                },
                function (error) {
                    console.error('post', error);
                    resolve({ success: false, error: error });
                }
            );
        })
        return data;
    }catch(err) {
        console.error(err);
        return { success: false, error: err };
    }
}

async function postTravelDigestCommentWinner(type, winner_title, winner_author, winner_permlink, digest_title, digest_permlink, curator_hive_username) {
    try {
        const data = await new Promise(async (resolve, reject) => {
            const privateKey = PrivateKey.fromString(
                process.env.HIVE_POSTING_KEY
            );
            let postBody = `Hiya, @${curator_hive_username} here, just swinging by to let you know that this post made it into our Top 3 in [${digest_title}](https://peakd.com/hive-163772/@pinmapple/${digest_permlink}).<br><br>Your post has been manually curated by the @pinmapple team. If you like what we're doing, please drop by to check out all the rest of today's great posts and consider supporting other authors like yourself and us so we can keep the project going!<br><br><b>Become part of our travel community:</b><ul><li><a href='https://discord.gg/EGtBvSM'>Join our Discord</a></li></ul>`
            if(type === 'honorable_mentions')
                postBody = `Hiya, @${curator_hive_username} here, just swinging by to let you know that this post made it into our Honorable Mentions in [${digest_title}](https://peakd.com/hive-163772/@pinmapple/${digest_permlink}).<br><br>Your post has been manually curated by the @pinmapple team. If you like what we're doing, please drop by to check out all the rest of today's great posts and consider supporting other authors like yourself and us so we can keep the project going!<br><br><b>Become part of our travel community:</b><ul><li><a href='https://discord.gg/EGtBvSM'>Join our Discord</a></li></ul>`
            const commentPayload = {
                parent_author: winner_author,
                parent_permlink: winner_permlink,
                author: process.env.HIVE_USERNAME,
                permlink: uuidv4().replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase(),
                title: "RE: " + winner_title,
                body: postBody,
                json_metadata: JSON.stringify({ tags: ["hive-163772"] }),
            };
            console.log(postBody);
            const client = new HiveClient(["https://anyx.io"]);
            client.broadcast
            .comment(
                commentPayload,
                privateKey
            )
            .then(
                function (result) {
                    resolve({ success: true, data: result });
                },
                function (error) {
                    console.error('comment', error);
                    resolve({ success: false, error: error });
                }
            );
        });
        return data;
    }catch(err) {
        console.error(err);
        return { success: false, error: err };
    }
}

async function voteTravelDigestWinners(type, winner_author, winner_permlink, weight) {
    try {
        const data = await new Promise(async (resolve, reject) => {
            const privateKey = PrivateKey.fromString(
                process.env.HIVE_POSTING_KEY
            );            
            const votePayload = {
                voter: process.env.HIVE_USERNAME,
                author: winner_author,
                permlink: winner_permlink,
                weight: type === 'honorable_mentions' ? 4000 : 10000 //weight : (3 * weight) //needs to be an integer for the vote function
            };
            console.log(votePayload);
            const client = new HiveClient(["https://anyx.io"]);
            client.broadcast
            .vote(
                votePayload,
                privateKey
            )
            .then(
                function (result) {
                    resolve({ success: true, data: result });
                },
                function (error) {
                    console.error('vote', error);
                    resolve({ success: false, error: error });
                }
            );
        });
        return data;
    }catch(err) {
        console.error(err);
        return { success: false, error: err };
    }
}

async function getVotePower() {
    const hiveusername = process.env.HIVE_USERNAME;
    try {
        const voting_power = await new Promise(async (resolve, reject) => {
            const client = new HiveClient(["https://anyx.io"]);
            let clientResponse = client.database.call('get_accounts', [[hiveusername]]).then((response, error) => {
                if (response) {
                    console.log(response[0].voting_power);
                    resolve(response[0].voting_power)
                } else {
                    resolve(response)
                }
            });
            return clientResponse
        })
        return voting_power;
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function updateEditorsChoice(postId) {
    try { 
        return new Promise(async resolve => {
            pool.query("UPDATE markerinfo SET editorsChoice = 1 WHERE id = ?;", [postId], async (err, rows, fields) => {
                if (err) {
                    return resolve(false);
                } else {
                    return resolve(rows);
                }
            });
        });
    }catch(err) {
        console.log(err);
        return null;
    }
}

async function postToTopThree(topThree, digestNumber) {
    try {
        return new Promise(async resolve => {
            let message = 'TD' + digestNumber + '     ';
            for (var i = 0; i < topThree.length; i++) {
                message += topThree[i].username + '     ';
            }
            const channel = await discord_client.channels.fetch(process.env.DISCORD_CHANNEL_ID_TOP_THREE);
            await channel.send(message);
            return resolve(true);
        });
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function postToTDChannel(postLink) {
    try {
        const channel = await discord_client.channels.fetch(process.env.DISCORD_CHANNEL_ID_TRAVEL_DIGEST);
        await channel.send(postLink);
    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    sc_valid,
    valid_login,
    encrypt,
    decrypt,
    generateAndInsertTokens,
    getPostBody,
    formulatePostBody,
    postTravelDigest,
    postTravelDigestCommentWinner,
    getVotePower,
    voteTravelDigestWinners,
    updateEditorsChoice,
    postToTopThree,
    postToTDChannel
};