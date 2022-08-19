const express = require('express');
const cors = require('cors');

const bcrypt = require('bcrypt');
const authCheck = require('./middleware/checkAuth');
const { generateToken } = require('./utils');

const { pool } = require('./db');

const http = require('http')

const app = express();
const {Server} = require('socket.io')
const PORT = 3032;
const server = http.createServer(app)
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
    const saltRounds = 10; // Required for authentication
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
    const mapId = req.body.map_id;
    const roomCode = req.body.room_code; // temp static code, we'll generate a room code for players
    const hostedBy = req.body.hosted_by;
    try {
        const sql = `INSERT INTO games (map_id, room_code, hosted_by, is_public) VALUES ($1, $2, $3, $4) returning *;`
        const databaseResult = await pool.query(sql, [mapId, roomCode, hostedBy, false]);
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
Route to remove a game from the database
Rquirements to use:
-> game_id passed through the route
*/
app.delete('/game/:id', async(req, res) => {
    const gameId = req.params.id;
    try {
        const sql = `DELETE FROM games WHERE game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
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

app.patch('/map/:id/image', async(req, res) => {
    const mapId = req.params.id;
    const mapImage = req.body.map_img;
    try{
        const sql = `UPDATE maps SET map_img = $2 WHERE map_id = $1`
        const databaseResult = await pool.query(sql, [mapId, mapImage])
        console.log(databaseResult);
        res.status(200).json({
            databaseResult
        })
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
});

// Route to get all the maps from the database
app.get('/maps', async(req, res) => {
    try{
        const databaseResult = await pool.query(`SELECT * FROM maps`);
        console.log(databaseResult.rows);
        res.json({
            data: databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

// Route to get a specific map from the database
app.get('/maps/:id', async(req, res) => {
    const mapId = req.params.id;
    try{
        const sql = `SELECT * FROM maps where map_id = $1`
        const databaseResult = await pool.query(sql, [mapId])
        res.status(200).json({
            gameInfo : databaseResult.rows[0]
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

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

// Route to get a specific game's map 
// (Games table only obtains map_id so with this we can connect the map_id to the map_id in the maps table to obtain the map data)
app.get('/game/:id/map/:mapid', async(req, res) => {
    const id = req.params.id
    const mapId = req.params.mapid
    try{
        const sql = (`SELECT * FROM maps join games on game_id = $1 where $2 = maps.map_id`)
        const databaseResult = await pool.query(sql, [id, mapId])
        console.log(databaseResult)
        res.status(200).json({
            data: databaseResult.rows
        })
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

// Route to get a specific game from the database
app.get('/games/:id', async(req, res) => {
    const gameId = req.params.id
    try{
        const sql = `SELECT * FROM games where game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
        res.status(200).json({
            gameInfo : databaseResult.rows[0]
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

app.get('/', async(req, res) => {
    console.log("hello")
})


//socket Io server
const io = new Server(server,{
    cors:{
        origin:"http://localhost:3000",
        methods:['GET'],
        credentials: true

    }
})
//makes room code
function makeid (){
    let code = ""
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        const charactersLength = characters.length;
    
        for(let i=0; i<6;i++){
            code += characters.charAt(Math.floor(Math.random() * charactersLength))
        }
        console.log(code)
        return code
}
const clientRooms = {}

io.on('connection', (socket)=>{
console.log(`User connected ${socket.id}`)

socket.on('newGame', handleNewGame)
socket.on('joinGame', handleJoinGame)

function handleJoinGame(gameCode){
const room = io.sockets.adapter.rooms[gameCode]
let allUsers;
if(room){
    allUsers = room.sockets
}
let numClients = 0
if(allUsers){
    numClients = Object.keys(allUsers).length
}
if(numClients === 0 ){
    socket.emit('unknownGame')
    return
}else if(numClients > 4) {
socket.emit('tooManyPlayers')
return
}
clientRooms[socket.id] = gameCode
socket.join(gameCode)
let clientNum = socket.number ++
socket.emit('init', clientNum)

}

function handleNewGame(){
    let roomName = makeid()
    clientRooms[socket.id] = roomName
    socket.emit('gameCode', roomName)
    socket.join(roomName)
    let clientNum = socket.number = 1
    socket.emit('init' , clientNum)
}
})






server.listen(3002, ()=> {
    console.log('Socket.io server is running ')
   
})
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
});