const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const authCheck = require('./middleware/checkAuth');
const { generateToken } = require('./utils');

const { pool } = require('./db');

const app = express();
const PORT = 3032;

app.use(express.json());
app.use(cors());

/* 
Route to add a new user to our players table
Requirements for the body to use: 
- username (less than 20 characters long)
- password (password chosen to sign in with this account)
*/
app.post('/signup', async(req, res) => {
    const playerUsername = req.body.username;
    const playerPassword = req.body.password;
    const saltRounds = 10 // Required for authentication
    try {
        const hashedPassword = await bcrypt.hash(playerPassword, saltRounds);
        const sql = `INSERT INTO players (username, password, pfp_link, games_won, games_lost) VALUES ($1, $2, $3, $4, $5) returning *;`
        const databaseResult = await pool.query(sql, [playerUsername, hashedPassword, null, 0, 0]);
        console.log(databaseResult);
        const playerToken = generateToken(databaseResult.rows[0].player_id);
        res.status(201).json({
            newPlayer: databaseResult.rows[0],
            token: playerToken
        })
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to login
Requirements for the body to use:
- username -> used to query the database for the hashed password
- password -> used when signing up to test against decrypted hashed password in DB
*/
app.post('/login', async(req, res) => {
    try{
        const { username, password } = req.body;
        const sql = `SELECT * from players where username $1`
        const databaseResult = await pool.query(sql, [username]);
        if(!databaseResult.rows[0]){
            return res.status(401).json({
                message: "You sure you have the right username?",
            });
        }
        const isPasswordCorrect = await bcrypt.compare(password, databaseResult.rows[0].password)
        if(!isPasswordCorrect){
            return res.status(401).json({
                message: "You sure you have the right password?",
            });
        }
        const token = generateToken();
        return res.status(200).json({
            playerInfo: databaseResult.rows[0],
            token
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

// Route to get all players from database
app.get('/players', async(req, res) => {
    try {
        const databaseResult = await pool.query(`SELECT * FROM players`)
        console.log(databaseResult.rows);
        res.json({
            data: databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to create / host a game
Requirements for the body to use: 
- map_id -> used to determine which map the players will play in
- room_code -> used to let other players join the room 
(upon creating the game we will generate a room_code for the player to share but as of right now, it's static)
*/
app.post('/game', async(req, res) => {
    const roomCode = "test";
    const mapSelected = req.body.map_id;
    try {
        const sql = `INSERT INTO games (map_id, room_code) VALUES ($1, $2) returning *;`
        const databaseResult = await pool.query(sql, [mapSelected, roomCode]);
        res.status(201).json({
          game: databaseResult.rows  
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to add players in the game lobby to the database
Requirements for the body to use:
- player_id -> used to be inserted into the db
- game_id -> is in the url that will be used to insert into the db as well
*/
app.post('/game/:id/lobby', async(req, res) => {
    const playerId = req.body.player_id;
    const gameId = req.params.id
    try {
        const sql = `INSERT INTO "gamePlayers" (game_id, player_id) VALUES ($1, $2) returning *;`
        const databaseResult = await pool.query(sql, [gameId, playerId]);
        console.log(databaseResult);
        res.status(201).json({
            data: databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to join a existing game
Requirements for the body to use: 
- room_code -> used to be search for the game and enter the game if room_code given is correct.
*/
app.post('/join', async(req, res) => {
    const roomCode = req.body.room_code
    try {
        const sql = `SELECT * FROM games where room_code = $1`
        const databaseResult = await pool.query(sql, [roomCode])
        console.log(databaseResult);
        if(!databaseResult.rows[0]){
            return res.status(401).json({
                message: "Incorrect room code",
            });
        }
        let isRoomCodeCorrect = false
        if(roomCode === databaseResult.rows[0].room_code){
            isRoomCodeCorrect = true;
            return res.status(200).json({
                data: databaseResult.rows[0],
                roomCode
            });
        }
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to remove a player from a game / room
Requirements for body to use:
- player_id -> used to remove that player from the database
(once player joins back they will be added onto the gamesPlayer table)
*/
app.delete('/leave/:id', async(req, res) => {
    const gameId = req.params.id;
    const playerId = req.body.player_id;
    try{
        const sql = `DELETE FROM "gamePlayers" WHERE player_id = $1`
        const databaseResult = await pool.query(sql, [playerId]);
        console.log(databaseResult);
        res.sendStatus(204);
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to update the games_won column for the players who won a game
Requirements for body to use:
- player_id -> used to determine whose stats are we updating?
*/
app.patch('/win', async(req, res) => {
    const playerId = req.body.player_id;
    try {
        const sql = `UPDATE players SET games_won = games_won + 1 WHERE player_id = $1`
        const databaseResult = await pool.query(sql, [playerId]);
        console.log(databaseResult);
        res.status(200).json({
            databaseResult
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to update the games_lost column for the players who lost a game
Requirements for body to use:
- player_id -> used to determine whose stats are we updating?
*/
app.patch('/lose', async(req, res) => {
    const playerId = req.body.player_id;
    try {
        const sql = `UPDATE players SET games_lost = games_lost + 1 WHERE player_id = $1`
        const databaseResult = await pool.query(sql, [playerId]);
        console.log(databaseResult);
        res.status(200).json({
            databaseResult
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

/*
Route to update player profile picture
Requirements for the body to use: 
- player_id is taken from url -> used to determine whose profile picture are we changing / assigning
- pfp_link -> a link of the picture the player wants as their profile picture
-  
*/
app.patch('/player/:id/picture', async(req, res) => {
    const playerId = req.params.id;
    const playerPic = req.body.pfp_link;
    try{
        const sql = `UPDATE players SET pfp_link = $2 WHERE player_id = $1`
        const databaseResult = await pool.query(sql, [playerId, playerPic])
        console.log(databaseResult);
        res.status(200).json({
            databaseResult
        })
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

// Route to get all existing games from the database
app.get('/games', async(req, res) => {
    try {
        const databaseResult = await pool.query(`SELECT * FROM games`);
        console.log(databaseResult.rows);
        res.json({
            data: databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

// Route to get the players and have them ordered from games_won descending
// Return the player's username and the number of games won
app.get('/leaderboard', async(req, res) => {
    try{
        const databaseResult = await pool.query(`SELECT username, games_won FROM players ORDER BY games_won DESC`);
        console.log(databaseResult);
        res.json({
            data: databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
});