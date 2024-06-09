require("dotenv").config();
const pool = require("../helpers/connection");
const utils = require("../helpers/utils");
const moment = require('moment');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    lastUncurated: (req, res, next) => {
        const applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue,
        (SELECT reason from banlist WHERE markerinfo.username = banlist.username) as banReason,
        postUpvote, postInfo, postQuality FROM markerinfo WHERE isCurated is NULL OR isCurated = 0 ORDER BY timestamp ASC LIMIT 1; 
        SELECT postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality FROM markerinfo WHERE isCurated is NULL ORDER BY timestamp DESC LIMIT 1; 
        SELECT COUNT(*) as count FROM markerinfo WHERE isCurated is NULL;
        SELECT COUNT(*) as count FROM markerinfo WHERE (postQuality = 1 OR postQuality = 2) AND editorsChoice is NULL;`;
        pool.query(applicationQuery, async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                let oldestPost = selectrows[0].length ? selectrows[0][0] : null;
                let latestPost = selectrows[1].length ? selectrows[1][0] : null;
                let countLeft = selectrows[2];
                let countCurated = selectrows[3];
                let hoursleft;
                if (oldestPost) {
                    await pool.query("UPDATE markerinfo SET isCurated = 2, curator = ? WHERE id = ?", [req.tokenData.id, oldestPost.id]);
                    const postBody = await utils.getPostBody(oldestPost.username, oldestPost.postPermLink);
                    if (postBody && postBody.body) {
                        oldestPost['postBody'] = postBody.body;
                        oldestPost['postWordCount'] = postBody.wordCount;
                    }
                    hoursleft = moment(latestPost.timestamp).diff(moment(oldestPost.timestamp)) / 1000 / 3600
                }
                return res.json({
                    post: oldestPost,
                    countLeft: countLeft.length && countLeft[0].count,
                    countCurated: countCurated.length && countCurated[0].count,
                    hoursleft: hoursleft ? parseInt(hoursleft.toFixed()) : 0,
                });
            }
        });
    },
    doneEditing: (req, res, next) => {
        const applicationQuery = "UPDATE markerinfo SET isCurated=NULL WHERE isCurated=2";
        pool.query(applicationQuery, (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                return res.json(selectrows);
            }
        });
    },
    updatePosts: (req, res, next) => {
        const posts = req.body.posts && req.body.posts.length ? req.body.posts : [];
        if (posts.length) {
            let queryString = '';
            let queryParams = [];
            for (var i = 0; i < posts.length; i++) {
                let post = posts[i];
                if (
                    ((Object.keys(post).indexOf('postQuality') > -1) && post.postQuality != undefined && post.postQuality != null) ||
                    ((Object.keys(post).indexOf('postInfo') > -1) && post.postInfo != undefined && post.postInfo != null) ||
                    ((Object.keys(post).indexOf('isCurated') > -1) && post.isCurated != undefined && post.isCurated != null) || 
                    ((Object.keys(post).indexOf('topThreeOrder') > -1) && post.topThreeOrder != undefined && post.topThreeOrder != null) || 
                    ((Object.keys(post).indexOf('featuredText') > -1) && post.featuredText != undefined && post.featuredText != null)
                ) {
                    let whereParamsCount = 0;
                    queryString += 'UPDATE markerinfo SET '
                    if ((Object.keys(post).indexOf('postQuality') > -1) && post.postQuality != undefined && post.postQuality != null) {
                        queryString += ' postQuality = ? '
                        queryParams.push(post.postQuality);
                        whereParamsCount++;
                        if(post.postQuality === 1 || post.postQuality === 2){
                            queryString +=
                                whereParamsCount > 0 ? `, editorsChoice = ?` : `editorsChoice = ?`;
                            queryParams.push(1);
                            whereParamsCount++;
                        }else{
                            queryString +=
                                whereParamsCount > 0 ? `, editorsChoice = ?` : `editorsChoice = ?`;
                            queryParams.push(null);
                            whereParamsCount++;
                        }
                    }
                    if ((Object.keys(post).indexOf('postInfo') > -1) && post.postInfo != undefined && post.postInfo != null) {
                        queryString +=
                            whereParamsCount > 0 ? `, postInfo = ?` : `postInfo = ?`;
                        queryParams.push(post.postInfo);
                        whereParamsCount++;
                    }
                    if ((Object.keys(post).indexOf('isCurated') > -1) && post.isCurated != undefined && post.isCurated != null) {
                        queryString +=
                            whereParamsCount > 0 ? `, isCurated = ?` : `isCurated = ?`;
                        queryParams.push(post.isCurated);
                        whereParamsCount++;
                    }
                    if ((Object.keys(post).indexOf('topThreeOrder') > -1) && post.topThreeOrder != undefined && post.topThreeOrder != null) {
                        queryString +=
                            whereParamsCount > 0 ? `, topThreeOrder = ?` : `topThreeOrder = ?`;
                        queryParams.push(post.topThreeOrder);
                        whereParamsCount++;
                    }
                    if ((Object.keys(post).indexOf('featuredText') > -1) && post.featuredText != undefined && post.featuredText != null) {
                        queryString +=
                            whereParamsCount > 0 ? `, featuredText = ?` : `featuredText = ?`;
                        queryParams.push(post.featuredText);
                        whereParamsCount++;
                    }
                    queryString += ' WHERE id = ?; ';
                    queryParams.push(post.id);
                }
            };
            console.log(queryString, queryParams)
            pool.query(queryString, queryParams, (err, selectrows, fields) => {
                if (err) {
                    return next(err);
                } else {
                    return res.json(selectrows);
                }
            });
        } else {
            return res.status(400);
        }

    },
    posts: (req, res, next) => {
        const applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue,
        (SELECT reason from banlist WHERE markerinfo.username = banlist.username) as banReason,
        postUpvote, postInfo, postQuality FROM markerinfo WHERE isCurated = 1 AND isDigested = NULL ORDER BY postQuality ASC;`;
        pool.query(applicationQuery, async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                return res.json(selectrows)
            }
        });
    },
    resetCuration: (req, res, next) => {
        let applicationQuery = `UPDATE markerinfo SET isCurated = NULL, curator = NULL WHERE isCurated = 2`;
        let queryParams = [];
        if (req.body.id) {
            applicationQuery += ` AND id = ?`;
            queryParams.push(req.body.id);
        }
        pool.query(applicationQuery, queryParams, async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                return res.json(selectrows)
            }
        });
    },
    lastCurated: (req, res, next) => {
        const applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo,
        (SELECT reason from banlist WHERE markerinfo.username = banlist.username) as banReason,
        postQuality FROM markerinfo WHERE isCurated = 1 AND curator = ? ORDER BY timestamp DESC LIMIT 1;
        SELECT postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality FROM markerinfo WHERE isCurated is NULL ORDER BY timestamp DESC LIMIT 1; 
        SELECT COUNT(*) as count FROM markerinfo WHERE isCurated is NULL;
        SELECT COUNT(*) as count FROM markerinfo WHERE (postQuality = 1 OR postQuality = 2) AND editorsChoice is NULL;`;
        console.log(req.tokenData);
        pool.query(applicationQuery, [req.tokenData.id], async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                let oldestPost = selectrows[0].length ? selectrows[0][0] : null;
                let latestPost = selectrows[1].length ? selectrows[1][0] : null;
                let countLeft = selectrows[2];
                let countCurated = selectrows[3];
                let hoursleft;
                if (oldestPost) {
                    await pool.query("UPDATE markerinfo SET isCurated = 2, curator = ? WHERE id = ?", [req.tokenData.id, oldestPost.id]);
                    const postBody = await utils.getPostBody(oldestPost.username, oldestPost.postPermLink);
                    if (postBody && postBody.body) {
                        oldestPost['postBody'] = postBody.body;
                        oldestPost['postWordCount'] = postBody.wordCount;
                    }
                    hoursleft = moment(latestPost.timestamp).diff(moment(oldestPost.timestamp)) / 1000 / 3600
                } else {
                    oldestPost = (await pool.query("SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality FROM markerinfo WHERE isCurated = 1 ORDER BY timestamp DESC LIMIT 1;"))[0];
                    if (oldestPost) {
                        await pool.query("UPDATE markerinfo SET isCurated = 2, curator = ? WHERE id = ?", [req.tokenData.id, oldestPost.id]);
                        const postBody = await utils.getPostBody(oldestPost.username, oldestPost.postPermLink);
                        if (postBody && postBody.body) {
                            oldestPost['postBody'] = postBody.body;
                            oldestPost['postWordCount'] = postBody.wordCount;
                        }
                        hoursleft = moment(latestPost.timestamp).diff(moment(oldestPost.timestamp)) / 1000 / 3600
                    }
                }
                return res.json({
                    post: oldestPost,
                    countLeft: countLeft.length && countLeft[0].count,
                    countCurated: countCurated.length && countCurated[0].count,
                    hoursleft: hoursleft ? parseInt(hoursleft.toFixed()) : null
                });
            }
        });
    },
    digestReady: (req, res, next) => {
        const applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, topThreeOrder, 
        postValue, postUpvote, postInfo, postQuality FROM markerinfo WHERE isCurated = 1 && isDigested = 0;
        SELECT intro from user_data where id = ?;
        `;
        pool.query(applicationQuery, [req.tokenData.id], async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                return res.json({
                    intro: selectrows[1][0].intro,
                    posts: selectrows[0]
                })
            }
        });
    },
    digestPreview: (req, res, next) => {
        let applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality, postDescription, postImageLink, featuredText
        FROM markerinfo WHERE isCurated = 1 AND isDigested = 0 AND postQuality = 1 AND (topThreeOrder = 1 OR topThreeOrder = 2 OR topThreeOrder = 3) ORDER BY topThreeOrder ASC LIMIT 3;
        SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality, postDescription, postImageLink, featuredText
        FROM markerinfo WHERE isCurated = 1 AND isDigested = 0 AND postQuality = 2;
        SELECT intro FROM user_data where id = ?`;
        pool.query(applicationQuery, [req.tokenData.id], async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                let topThree = selectrows[0].length ? selectrows[0] : null;
                if(topThree && topThree.length && topThree.length === 3){
                    let honorableMentions = selectrows[1].length ? selectrows[1] : null;
                    const intro = selectrows[2].length ? selectrows[2][0].intro : null;
                    const completeHtmlResp = utils.formulatePostBody(intro, topThree, honorableMentions);
                    if(completeHtmlResp.success) {
                        res.status(200).json(completeHtmlResp);
                    }else{
                        res.status(500).json({msg : "Error while generating post", error: completeHtmlResp.error});
                    }
                }else{
                    res.status(400).json({msg : "Top 3 not selected yet"});
                }
            }
        });
    },
    setDigested: (req, res, next) => {
        let applicationQuery = `UPDATE markerinfo SET isDigested = 1 WHERE isCurated = 1 AND isDigested = 0`;
        pool.query(applicationQuery, async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                return res.json(selectrows)
            }
        });
    },
    postDigest: (req, res, next) => {
        const digestNumber = req.body.digest_number;
        const title = 'Travel Digest #' + digestNumber;
        let applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality, postDescription, postImageLink, featuredText
        FROM markerinfo WHERE isCurated = 1 AND isDigested = 0 AND postQuality = 1 AND (topThreeOrder = 1 OR topThreeOrder = 2 OR topThreeOrder = 3) ORDER BY topThreeOrder ASC LIMIT 3;
        SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality, postDescription, postImageLink, featuredText
        FROM markerinfo WHERE isCurated = 1 AND isDigested = 0 AND postQuality = 2;
        SELECT intro FROM user_data where id = ?`;
        pool.query(applicationQuery, [req.tokenData.id], async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                let topThree = selectrows[0].length ? selectrows[0] : null;
                if(topThree && topThree.length && topThree.length === 3){
                    let honorableMentions = selectrows[1].length ? selectrows[1] : null;
                    const intro = selectrows[2].length ? selectrows[2][0].intro : null;
                    const completeHtmlResp = utils.formulatePostBody(intro, topThree, honorableMentions);
                    if(completeHtmlResp.success) {
                        let voting_power = await utils.getVotePower();
                        voting_power = voting_power - 7500;//0.75 * voting_power;
                        normalisedVotingPower = Math.round(voting_power / ( 9 + honorableMentions.length));
                        digestPermlink = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase();
                        const postToHiveResponse = await utils.postTravelDigest(completeHtmlResp.data, title, digestPermlink);
                        console.log(postToHiveResponse);
                        if(postToHiveResponse.success) {
                            res.status(200).json({data: postToHiveResponse.data})
                            let commentVoteToWinnersResp = {}
                            for (const [index, element] of topThree.entries()) {
                                commentVoteToWinnersResp[`topThreeComment_${index}`] = await utils.postTravelDigestCommentWinner('topthree', element.postTitle, element.username, element.postPermLink, title, digestPermlink, req.tokenData.username);
                                await delay(3000);
                                commentVoteToWinnersResp[`topThreeVote_${index}`] = await utils.voteTravelDigestWinners('topthree', element.username, element.postPermLink, normalisedVotingPower);
                                commentVoteToWinnersResp[`topThreeEditorsChoice_${index}`] = await utils.updateEditorsChoice(element.id);
                            }
                            for (const [index, element] of honorableMentions.entries()) {
                                commentVoteToWinnersResp[`honorableMentionsComment_${index}`] = await utils.postTravelDigestCommentWinner('honorable_mentions', element.postTitle, element.username, element.postPermLink, title, digestPermlink, req.tokenData.username);
                                await delay(3000);
                                commentVoteToWinnersResp[`honorableMentionsVote_${index}`] = await utils.voteTravelDigestWinners('honorable_mentions', element.username, element.postPermLink, normalisedVotingPower);
                                commentVoteToWinnersResp[`honorableMentionsEditorsChoice_${index}`] = await utils.updateEditorsChoice(element.id);
                            }
                            commentVoteToWinnersResp['postToTopThree'] = await utils.postToTopThree(topThree, digestNumber);
                            commentVoteToWinnersResp['postToTDChannel'] = await utils.postToTDChannel('https://peakd.com/hive-163772/@pinmapple/' + digestPermlink);
                        }else{
                            res.status(500).json({msg : "Error while posting to Hive", error: postToHiveResponse.error});
                        }
                    }else{
                        res.status(500).json({msg : "Error while generating post", error: completeHtmlResp.error});
                    }
                }else{
                    res.status(400).json({msg : "Top 3 not selected yet"});
                }
            }
        });
    },
    testpostDigest: (req, res, next) => {
        const digestNumber = req.body.digest_number;
        const title = 'Travel Digest #' + digestNumber;
        let applicationQuery = `SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality, postDescription, postImageLink, featuredText
        FROM markerinfo WHERE isCurated = 1 AND isDigested = 0 AND postQuality = 1 AND (topThreeOrder = 1 OR topThreeOrder = 2 OR topThreeOrder = 3) ORDER BY topThreeOrder ASC LIMIT 3;
        SELECT id, postLink, username, timestamp, postTitle, postPermLink, postDate, postValue, postUpvote, postInfo, postQuality, postDescription, postImageLink, featuredText
        FROM markerinfo WHERE isCurated = 1 AND isDigested = 0 AND postQuality = 2;
        SELECT intro FROM user_data where id = ?`;
        pool.query(applicationQuery, [req.tokenData.id], async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                let topThree = selectrows[0].length ? selectrows[0] : null;
                if(topThree && topThree.length && topThree.length === 3){
                    let honorableMentions = selectrows[1].length ? selectrows[1] : null;
                    const intro = selectrows[2].length ? selectrows[2][0].intro : null;
                    const completeHtmlResp = utils.formulatePostBody(intro, topThree, honorableMentions);
                    if(completeHtmlResp.success) {
                        let voting_power = await utils.getVotePower();
                        voting_power = voting_power - 7500;//0.75 * voting_power;
                        normalisedVotingPower = Math.round(voting_power / ( 9 + honorableMentions.length));
                        digestPermlink = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase();
                        const postToHiveResponse = await utils.postTravelDigest(completeHtmlResp.data, title, digestPermlink);
                        console.log(postToHiveResponse);
                        if(postToHiveResponse.success) {
                            // let postTravelDigestCommentWinnerPromiseArr = [];
                            // topThree.forEach(element => {
                            //     postTravelDigestCommentWinnerPromiseArr.push(
                            //         utils.postTravelDigestCommentWinner('topthree', element.postTitle, element.username, element.postPermLink, title, digestPermlink)
                            //     );
                            //     postTravelDigestCommentWinnerPromiseArr.push(
                            //         utils.voteTravelDigestWinners('topthree', element.username, element.postPermLink, normalisedVotingPower)
                            //     );
                            //     postTravelDigestCommentWinnerPromiseArr.push(
                            //         utils.updateEditorsChoice(element.id)
                            //     );
                            // });
                            // honorableMentions.forEach(element => {
                            //     postTravelDigestCommentWinnerPromiseArr.push(
                            //         utils.postTravelDigestCommentWinner('honorable_mentions', element.postTitle, element.username, element.postPermLink, title, digestPermlink)
                            //     );
                            //     postTravelDigestCommentWinnerPromiseArr.push(
                            //         utils.voteTravelDigestWinners('honorable_mentions', element.username, element.postPermLink, normalisedVotingPower)
                            //     );
                            //     postTravelDigestCommentWinnerPromiseArr.push(
                            //         utils.updateEditorsChoice(element.id)
                            //     );
                            // });
                            // postTravelDigestCommentWinnerPromiseArr.push(
                            //     utils.postToTopThree(topThree, digestNumber)
                            // );
                            // postTravelDigestCommentWinnerPromiseArr.push(
                            //     utils.postToTDChannel('https://peakd.com/hive-163772/@pinmapple/' + digestPermlink)
                            // );
                            // const commentVoteToWinnersResp = await Promise.all(postTravelDigestCommentWinnerPromiseArr);
                            res.status(200).json({data: postToHiveResponse.data})
                        }else{
                            res.status(500).json({msg : "Error while posting to Hive", error: postToHiveResponse.error});
                        }
                    }else{
                        res.status(500).json({msg : "Error while generating post", error: completeHtmlResp.error});
                    }
                }else{
                    res.status(400).json({msg : "Top 3 not selected yet"});
                }
            }
        });
    },
    postsCurated: (req, res, next) => {
        let applicationQuery = `SELECT COUNT(id) as curatedWithPostQuality1 FROM markerinfo WHERE isDigested = 0 AND isCurated = 1 AND postQuality = 1;
        SELECT COUNT(id) as curatedWithPostQuality2 FROM markerinfo WHERE isDigested = 0 AND isCurated = 1 AND postQuality = 2;
        SELECT COUNT(id) as curatedWithPostQualityNullOr0 FROM markerinfo WHERE isDigested = 0 AND isCurated = 1 AND (postQuality IS NULL OR postQuality = 0);`;
        pool.query(applicationQuery, async (err, selectrows, fields) => {
            if (err) {
                return next(err);
            } else {
                let resp = {};
                selectrows.forEach((row) => {
                    resp = Object.assign(resp, row[0])
                });
                return res.json(resp)
            }
        });
    }
}