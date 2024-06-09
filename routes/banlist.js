const express = require('express')

const router = express.Router()

const auth = require("../middlewares/auth");
const { 
    addToBanlist,
    getBanlist,
    deleteFromBanlist
} = require('../controller/banlist');

router.post('/', auth, addToBanlist);
router.get('/', auth, getBanlist);
router.delete('/:username', auth, deleteFromBanlist);

module.exports = router
