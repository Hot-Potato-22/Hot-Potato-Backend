const jwt = require('jsonwebtoken');

const secretSigningKey = process.env.SECRET_KEY || 'shh'

const generateToken = (playerId) => {
    return jwt.sign({ playerId }, secretSigningKey)
}

const verifyToken = (token) => {
    return jwt.verify(token, secretSigningKey)
}

module.exports = {
    generateToken,
    verifyToken
}