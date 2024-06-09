const express = require('express')

const router = express.Router()

const auth = require("../middlewares/auth");
const { 
    lastUncurated,
    doneEditing,
    updatePosts,
    posts,
    resetCuration,
    lastCurated,
    digestReady,
    digestPosts,
    digestPreview,
    setDigested,
    postDigest,
    postsCurated,
    testpostDigest
} = require('../controller/fastcurate');

router.get('/last_uncurated', auth, lastUncurated)

router.post('/done_editing', auth, doneEditing)

router.post('/update_posts', auth, updatePosts)

router.get('/posts', auth, posts)

router.post('/reset_curation', auth, resetCuration)

router.get('/last_curated', auth, lastCurated)

router.get('/digest_ready', auth, digestReady)

// router.get('/digest_posts', auth, digestPosts)

router.get('/digest_preview', auth, digestPreview)

router.post('/post_digest', auth, postDigest)
router.post('/test_post_digest', auth, testpostDigest)

router.post('/set_digested', auth, setDigested)

router.get('/posts_curated', auth, postsCurated);

module.exports = router
