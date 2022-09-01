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
        const sql = `SELECT * from players where username = $1`
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

{
    "game": [
        {
            "game_id": 166,
            "map_id": 1,
            "room_code": "123456",
            "hosted_by": null,
            "is_public": false,
            "host_id": 1
        }
    ]
}

*/
app.post('/game', async(req, res) => {
    const mapId = req.body.map_id;
    const roomCode = req.body.room_code;
    const hostedBy = req.body.hosted_by;
    const hostId = req.body.host_id;
    try {
        const sql = `INSERT INTO games (map_id, room_code, hosted_by, host_id, is_public) VALUES ($1, $2, $3, $4, $5) returning *;`
        const databaseResult = await pool.query(sql, [mapId, roomCode, hostedBy, hostId, false]);
        const gameId = databaseResult.rows[0].game_id
        const sql2 = `INSERT INTO "gamePlayers" (game_id, player_id) VALUES ($1, $2) returning *;`
        const databaseResult2 = await pool.query(sql2, [gameId, hostId]);
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
            const gameId = databaseResult.rows[0].game_id
            const playerId = req.body.player_id
            const sql2 = `INSERT INTO "gamePlayers" (game_id, player_id) VALUES ($1, $2) returning *;`
            const databaseResult2 = await pool.query(sql2, [gameId, playerId])
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


app.delete('/player/:id', async(req, res) => {
    const playerId = req.params.id;
    try{
        const sql = `DELETE FROM players WHERE player_id = $1`
        const databaseResult = await pool.query(sql, [playerId])
        console.log(databaseResult)
        res.sendStatus(204);
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

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
Route to delete all players from a specific game then deletes the game
*/
app.delete('/game', async(req, res) => {
    const gameId = req.body.game_id
    try {
        const sql = `DELETE FROM "gamePlayers" WHERE game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
        console.log(databaseResult);
        const sql2 = `DELETE FROM games WHERE game_id = $1`
        const databaseResult2 = await pool.query(sql2, [gameId])
        console.log(databaseResult2);
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

// Route to set a specific map's image
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

// Route to make specific game public
app.patch('/game/:id/public', async(req, res) => {
    const gameId = req.params.id;
    try {
        const sql = `UPDATE games SET is_public = true WHERE game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
        console.log(databaseResult);
        res.status(200).json({
            databaseResult
        })
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

// Route to make a specific game private
app.patch('/game/:id/private', async(req, res) => {
    const gameId = req.params.id;
    try {
        const sql = `UPDATE games SET is_public = false WHERE game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
        console.log(databaseResult);
        res.status(200).json({
            databaseResult
        })
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

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

app.get('/game/players/:playerid', async(req, res) => {
    const playerId = req.params.playerid
    try{
        const sql = (`SELECT * FROM players join "gamePlayers" on players.player_id = $1 where $1 = "gamePlayers".player_id`)
        const databaseResult = await pool.query(sql, [playerId])
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

app.get('/games/:id/players', async(req, res) => {
    const gameId = req.params.id;
    try {
        const sql = `SELECT * FROM "gamePlayers" where game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
        res.status(200).json({
            playerList : databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})

app.get('/games/:id/players/playernames', async(req, res) => {
    const gameId = req.params.id;
    try {
        const sql = `SELECT players.username FROM players inner join "gamePlayers" on players.player_id = "gamePlayers".player_id where "gamePlayers".game_id = $1`
        const databaseResult = await pool.query(sql, [gameId])
        res.status(200).json({
            playerList : databaseResult.rows
        });
    } catch(error){
        res.status(500).json({ message: `${error.message }` });
    }
})


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




var players = {};

var star = {
    x: Math.floor(Math.random() * 1350) + 50,
    y: Math.floor(Math.random() * 700) + 50
};

var starTwo = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starThree = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starFour = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starFive = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starSix = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starSeven = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starEight = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starNine = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};

var starTen = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
};







var sandwich = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
}

var juice = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
}


  
  


// app.use(express.static(__dirname + '/public'));

// app.get('/', function (req, res) {
//   res.sendFile(__dirname + '/index.html');
// });

io.on('connection', function (socket) {
  console.log('a user connected');
  // create a new player and add it to our players object
  players[socket.id] = {
    rotation: 0,
    x: Math.floor(Math.random() * 1350) + 50,
    y: Math.floor(Math.random() *  700) + 50,
    playerId: socket.id,
    playerScore: 0,
    team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue'
  };
  currPlayers = Object.keys(players)
  numPlayers = currPlayers.length
  console.log(currPlayers)
  console.log(numPlayers)
  players[socket.id]["playerNum"] = numPlayers
  console.log(players)



  potato = {
    rotation: 0,
    x: Math.floor(Math.random() * 1350) + 50,
    y: Math.floor(Math.random() * 700) + 50
  };
  // send the players object to the new player
    socket.emit('currentPlayers', players);
    // send the star object to the new player
    socket.emit('starLocation', star);
    socket.emit('starTwoLocation', starTwo);
    socket.emit('starThreeLocation', starThree);
    socket.emit('starFourLocation', starFour);
    socket.emit('starFiveLocation', starFive);
    socket.emit('starSixLocation', starSix);
    socket.emit('starSevenLocation', starSeven);
    socket.emit('starEightLocation', starEight);
    socket.emit('starNineLocation', starNine);
    socket.emit('starTenLocation', starTen);
    
    //socket.emit('star3Location', star3);


    socket.emit('potatoLocation', potato);
    socket.emit('potatoMovement', potato);

    //setTimeout(() => {  
      socket.emit('sandwichLocation', sandwich);
    //}, 5000);

    socket.emit('juiceLocation', juice);

    // send the current scores

    //theScore = players[socket.id].playerScore

    socket.emit('playerScoreUpdate',{ 
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
    // update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);
    // when a player disconnects, remove them from our players object
    socket.on('disconnect', function () {
    
    console.log('user disconnected');
    // remove this player from our players object
    delete players[socket.id];
    // emit a message to all players to remove this player
    io.emit('disconnected', socket.id);
  });


  // when a player moves, update the player data
   socket.on('playerMovement', function (movementData) {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].rotation = movementData.rotation;
    // emit a message to all players about the player that moved
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  
  

  // socket.on('starCollected', function () {
  //   if (players[socket.id].team === 'red') {
  //     scores.red += 10;
  //   } else {
  //     scores.blue += 10;
  //   }
  //   star.x = Math.floor(Math.random() * 1350) + 50;
  //   star.y = Math.floor(Math.random() * 700) + 50;
  //   io.emit('starLocation', star);
  //   io.emit('scoreUpdate', scores);
  // });

   socket.on('starCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    star.x = Math.floor(Math.random() * 1350) + 50;

    star.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starLocation', star);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });


  socket.on('starTwoCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starTwo.x = Math.floor(Math.random() * 1350) + 50;

    starTwo.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starTwoLocation', starTwo);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });



  socket.on('starThreeCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starThree.x = Math.floor(Math.random() * 1350) + 50;

    starThree.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starThreeLocation', starThree);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });

  socket.on('starFourCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starFour.x = Math.floor(Math.random() * 1350) + 50;

    starFour.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starFourLocation', starFour);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });

  socket.on('starFiveCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starFive.x = Math.floor(Math.random() * 1350) + 50;

    starFive.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starFiveLocation', starFive);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });

  socket.on('starSixCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starSix.x = Math.floor(Math.random() * 1350) + 50;

    starSix.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starSixLocation', starSix);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });



  socket.on('starSevenCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starSeven.x = Math.floor(Math.random() * 1350) + 50;

    starSeven.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starSevenLocation', starSeven);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });



  socket.on('starEightCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starEight.x = Math.floor(Math.random() * 1350) + 50;

    starEight.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starEightLocation', starEight);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });



  socket.on('starNineCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starNine.x = Math.floor(Math.random() * 1350) + 50;
    starNine.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starNineLocation', starNine);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });

  socket.on('starTenCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3){
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4){
      players[socket.id].playerScore += 10;
    }
    starTen.x = Math.floor(Math.random() * 1350) + 50;
    starTen.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starTenLocation', starTen);
    io.emit('playerScoreUpdate', { theScore: players[socket.id].playerScore, playerNum: players[socket.id].playerNum});
  });





  

  socket.on('potatoCollected', function () {
    
    potato.x = Math.floor(Math.random() * 1350) + 50;
    potato.y = Math.floor(Math.random() * 700) + 50;
    io.emit('potatoLocation', potato);
  });
  

  socket.on('sandwichCollected', function () {
   
      sandwich.x = Math.floor(Math.random() * 1350) + 50;
      sandwich.y = Math.floor(Math.random() * 700) + 50;
      io.emit('sandwichLocation', sandwich);
   
    
  });

  socket.on('juiceCollected', function () {
    
    juice.x = Math.floor(Math.random() * 1350) + 50;
    juice.y = Math.floor(Math.random() * 700) + 50;
    io.emit('juiceLocation', juice);
   
  });


});






server.listen(3002, ()=> {
    console.log('Socket.io server is running ')
   
})
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
});