const express = require('express')

const router = express.Router()
const auth = require("../middlewares/auth");

const { 
    fetchMemo,
    login,
    verifyToken,
    updateIntro
} = require('../controller/auth');

router.post('/memo', fetchMemo);
router.post('/login', login);
router.get('/verify_token', auth, verifyToken);
router.post('/update_intro', auth, updateIntro);

module.exports = router
