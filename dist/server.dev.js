"use strict";

var express = require('express');

var cors = require('cors');

var bcrypt = require('bcrypt');

var authCheck = require('./middleware/checkAuth');

var _require = require('./utils'),
    generateToken = _require.generateToken;

var _require2 = require('./db'),
    pool = _require2.pool;

var http = require('http');

var app = express();

var _require3 = require('socket.io'),
    Server = _require3.Server;

var PORT = 3032;
var server = http.createServer(app);
app.use(express.json());
app.use(cors());
/* 
Route to add a new user to our players table
Requirements for the body to use: 
- username (less than 20 characters long)
- password (password chosen to sign in with this account)
*/

app.post('/signup', function _callee(req, res) {
  var playerUsername, playerPassword, saltRounds, hashedPassword, sql, databaseResult, playerToken;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          playerUsername = req.body.username;
          playerPassword = req.body.password;
          saltRounds = 10; // Required for authentication

          _context.prev = 3;
          _context.next = 6;
          return regeneratorRuntime.awrap(bcrypt.hash(playerPassword, saltRounds));

        case 6:
          hashedPassword = _context.sent;
          sql = "INSERT INTO players (username, password, pfp_link, games_won, games_lost) VALUES ($1, $2, $3, $4, $5) returning *;";
          _context.next = 10;
          return regeneratorRuntime.awrap(pool.query(sql, [playerUsername, hashedPassword, null, 0, 0]));

        case 10:
          databaseResult = _context.sent;
          console.log(databaseResult);
          playerToken = generateToken(databaseResult.rows[0].player_id);
          res.status(201).json({
            newPlayer: databaseResult.rows[0],
            token: playerToken
          });
          _context.next = 19;
          break;

        case 16:
          _context.prev = 16;
          _context.t0 = _context["catch"](3);
          res.status(500).json({
            message: "".concat(_context.t0.message)
          });

        case 19:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[3, 16]]);
});
/*
Route to login
Requirements for the body to use:
- username -> used to query the database for the hashed password
- password -> used when signing up to test against decrypted hashed password in DB
*/

app.post('/login', function _callee2(req, res) {
  var _req$body, username, password, sql, databaseResult, isPasswordCorrect, token;

  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _req$body = req.body, username = _req$body.username, password = _req$body.password;
          sql = "SELECT * from players where username = $1";
          _context2.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [username]));

        case 5:
          databaseResult = _context2.sent;

          if (databaseResult.rows[0]) {
            _context2.next = 8;
            break;
          }

          return _context2.abrupt("return", res.status(401).json({
            message: "You sure you have the right username?"
          }));

        case 8:
          _context2.next = 10;
          return regeneratorRuntime.awrap(bcrypt.compare(password, databaseResult.rows[0].password));

        case 10:
          isPasswordCorrect = _context2.sent;

          if (isPasswordCorrect) {
            _context2.next = 13;
            break;
          }

          return _context2.abrupt("return", res.status(401).json({
            message: "You sure you have the right password?"
          }));

        case 13:
          token = generateToken();
          return _context2.abrupt("return", res.status(200).json({
            playerInfo: databaseResult.rows[0],
            token: token
          }));

        case 17:
          _context2.prev = 17;
          _context2.t0 = _context2["catch"](0);
          res.status(500).json({
            message: "".concat(_context2.t0.message)
          });

        case 20:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 17]]);
}); // Route to get all players from database

app.get('/players', function _callee3(req, res) {
  var databaseResult;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(pool.query("SELECT * FROM players"));

        case 3:
          databaseResult = _context3.sent;
          console.log(databaseResult.rows);
          res.json({
            data: databaseResult.rows
          });
          _context3.next = 11;
          break;

        case 8:
          _context3.prev = 8;
          _context3.t0 = _context3["catch"](0);
          res.status(500).json({
            message: "".concat(_context3.t0.message)
          });

        case 11:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 8]]);
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

app.post('/game', function _callee4(req, res) {
  var mapId, roomCode, hostedBy, hostId, sql, databaseResult, gameId, sql2, databaseResult2;
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          mapId = req.body.map_id;
          roomCode = req.body.room_code;
          hostedBy = req.body.hosted_by;
          hostId = req.body.host_id;
          _context4.prev = 4;
          sql = "INSERT INTO games (map_id, room_code, hosted_by, host_id, is_public) VALUES ($1, $2, $3, $4, $5) returning *;";
          _context4.next = 8;
          return regeneratorRuntime.awrap(pool.query(sql, [mapId, roomCode, hostedBy, hostId, false]));

        case 8:
          databaseResult = _context4.sent;
          gameId = databaseResult.rows[0].game_id;
          sql2 = "INSERT INTO \"gamePlayers\" (game_id, player_id) VALUES ($1, $2) returning *;";
          _context4.next = 13;
          return regeneratorRuntime.awrap(pool.query(sql2, [gameId, hostId]));

        case 13:
          databaseResult2 = _context4.sent;
          res.status(201).json({
            game: databaseResult.rows
          });
          _context4.next = 20;
          break;

        case 17:
          _context4.prev = 17;
          _context4.t0 = _context4["catch"](4);
          res.status(500).json({
            message: "".concat(_context4.t0.message)
          });

        case 20:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[4, 17]]);
});
/*
Route to add players in the game lobby to the database
Requirements for the body to use:
- player_id -> used to be inserted into the db
- game_id -> is in the url that will be used to insert into the db as well
*/

app.post('/game/:id/lobby', function _callee5(req, res) {
  var playerId, gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          playerId = req.body.player_id;
          gameId = req.params.id;
          _context5.prev = 2;
          sql = "INSERT INTO \"gamePlayers\" (game_id, player_id) VALUES ($1, $2) returning *;";
          _context5.next = 6;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId, playerId]));

        case 6:
          databaseResult = _context5.sent;
          console.log(databaseResult);
          res.status(201).json({
            data: databaseResult.rows
          });
          _context5.next = 14;
          break;

        case 11:
          _context5.prev = 11;
          _context5.t0 = _context5["catch"](2);
          res.status(500).json({
            message: "".concat(_context5.t0.message)
          });

        case 14:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[2, 11]]);
});
/*
Route to join a existing game
Requirements for the body to use: 
- room_code -> used to be search for the game and enter the game if room_code given is correct.
*/

app.post('/join', function _callee6(req, res) {
  var roomCode, sql, databaseResult, isRoomCodeCorrect, gameId, playerId, sql2, databaseResult2;
  return regeneratorRuntime.async(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          roomCode = req.body.room_code;
          _context6.prev = 1;
          sql = "SELECT * FROM games where room_code = $1";
          _context6.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [roomCode]));

        case 5:
          databaseResult = _context6.sent;
          console.log(databaseResult);

          if (databaseResult.rows[0]) {
            _context6.next = 9;
            break;
          }

          return _context6.abrupt("return", res.status(401).json({
            message: "Incorrect room code"
          }));

        case 9:
          isRoomCodeCorrect = false;

          if (!(roomCode === databaseResult.rows[0].room_code)) {
            _context6.next = 19;
            break;
          }

          isRoomCodeCorrect = true;
          gameId = databaseResult.rows[0].game_id;
          playerId = req.body.player_id;
          sql2 = "INSERT INTO \"gamePlayers\" (game_id, player_id) VALUES ($1, $2) returning *;";
          _context6.next = 17;
          return regeneratorRuntime.awrap(pool.query(sql2, [gameId, playerId]));

        case 17:
          databaseResult2 = _context6.sent;
          return _context6.abrupt("return", res.status(200).json({
            data: databaseResult.rows[0],
            roomCode: roomCode
          }));

        case 19:
          _context6.next = 24;
          break;

        case 21:
          _context6.prev = 21;
          _context6.t0 = _context6["catch"](1);
          res.status(500).json({
            message: "".concat(_context6.t0.message)
          });

        case 24:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[1, 21]]);
});
/*
Route to remove a player from a game / room
Requirements for body to use:
- player_id -> used to remove that player from the database
(once player joins back they will be added onto the gamesPlayer table)
*/

app["delete"]('/leave/:id', function _callee7(req, res) {
  var gameId, playerId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee7$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          gameId = req.params.id;
          playerId = req.body.player_id;
          _context7.prev = 2;
          sql = "DELETE FROM \"gamePlayers\" WHERE player_id = $1";
          _context7.next = 6;
          return regeneratorRuntime.awrap(pool.query(sql, [playerId]));

        case 6:
          databaseResult = _context7.sent;
          console.log(databaseResult);
          res.sendStatus(204);
          _context7.next = 14;
          break;

        case 11:
          _context7.prev = 11;
          _context7.t0 = _context7["catch"](2);
          res.status(500).json({
            message: "".concat(_context7.t0.message)
          });

        case 14:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[2, 11]]);
});
app["delete"]('/player/:id', function _callee8(req, res) {
  var playerId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee8$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          playerId = req.params.id;
          _context8.prev = 1;
          sql = "DELETE FROM players WHERE player_id = $1";
          _context8.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [playerId]));

        case 5:
          databaseResult = _context8.sent;
          console.log(databaseResult);
          res.sendStatus(204);
          _context8.next = 13;
          break;

        case 10:
          _context8.prev = 10;
          _context8.t0 = _context8["catch"](1);
          res.status(500).json({
            message: "".concat(_context8.t0.message)
          });

        case 13:
        case "end":
          return _context8.stop();
      }
    }
  }, null, null, [[1, 10]]);
});
/*
Route to remove a game from the database
Rquirements to use:
-> game_id passed through the route
*/

app["delete"]('/game/:id', function _callee9(req, res) {
  var gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee9$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          gameId = req.params.id;
          _context9.prev = 1;
          sql = "DELETE FROM games WHERE game_id = $1";
          _context9.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context9.sent;
          console.log(databaseResult);
          res.sendStatus(204);
          _context9.next = 13;
          break;

        case 10:
          _context9.prev = 10;
          _context9.t0 = _context9["catch"](1);
          res.status(500).json({
            message: "".concat(_context9.t0.message)
          });

        case 13:
        case "end":
          return _context9.stop();
      }
    }
  }, null, null, [[1, 10]]);
});
/*
Route to delete all players from a specific game then deletes the game
*/

app["delete"]('/game', function _callee10(req, res) {
  var gameId, sql, databaseResult, sql2, databaseResult2;
  return regeneratorRuntime.async(function _callee10$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          gameId = req.body.game_id;
          _context10.prev = 1;
          sql = "DELETE FROM \"gamePlayers\" WHERE game_id = $1";
          _context10.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context10.sent;
          console.log(databaseResult);
          sql2 = "DELETE FROM games WHERE game_id = $1";
          _context10.next = 10;
          return regeneratorRuntime.awrap(pool.query(sql2, [gameId]));

        case 10:
          databaseResult2 = _context10.sent;
          console.log(databaseResult2);
          res.sendStatus(204);
          _context10.next = 18;
          break;

        case 15:
          _context10.prev = 15;
          _context10.t0 = _context10["catch"](1);
          res.status(500).json({
            message: "".concat(_context10.t0.message)
          });

        case 18:
        case "end":
          return _context10.stop();
      }
    }
  }, null, null, [[1, 15]]);
});
/*
Route to update the games_won column for the players who won a game
Requirements for body to use:
- player_id -> used to determine whose stats are we updating?
*/

app.patch('/win', function _callee11(req, res) {
  var playerId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee11$(_context11) {
    while (1) {
      switch (_context11.prev = _context11.next) {
        case 0:
          playerId = req.body.player_id;
          _context11.prev = 1;
          sql = "UPDATE players SET games_won = games_won + 1 WHERE player_id = $1";
          _context11.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [playerId]));

        case 5:
          databaseResult = _context11.sent;
          console.log(databaseResult);
          res.status(200).json({
            databaseResult: databaseResult
          });
          _context11.next = 13;
          break;

        case 10:
          _context11.prev = 10;
          _context11.t0 = _context11["catch"](1);
          res.status(500).json({
            message: "".concat(_context11.t0.message)
          });

        case 13:
        case "end":
          return _context11.stop();
      }
    }
  }, null, null, [[1, 10]]);
});
/*
Route to update the games_lost column for the players who lost a game
Requirements for body to use:
- player_id -> used to determine whose stats are we updating?
*/

app.patch('/lose', function _callee12(req, res) {
  var playerId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee12$(_context12) {
    while (1) {
      switch (_context12.prev = _context12.next) {
        case 0:
          playerId = req.body.player_id;
          _context12.prev = 1;
          sql = "UPDATE players SET games_lost = games_lost + 1 WHERE player_id = $1";
          _context12.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [playerId]));

        case 5:
          databaseResult = _context12.sent;
          console.log(databaseResult);
          res.status(200).json({
            databaseResult: databaseResult
          });
          _context12.next = 13;
          break;

        case 10:
          _context12.prev = 10;
          _context12.t0 = _context12["catch"](1);
          res.status(500).json({
            message: "".concat(_context12.t0.message)
          });

        case 13:
        case "end":
          return _context12.stop();
      }
    }
  }, null, null, [[1, 10]]);
});
/*
Route to update player profile picture
Requirements for the body to use: 
- player_id is taken from url -> used to determine whose profile picture are we changing / assigning
- pfp_link -> a link of the picture the player wants as their profile picture
-  
*/

app.patch('/player/:id/picture', function _callee13(req, res) {
  var playerId, playerPic, sql, databaseResult;
  return regeneratorRuntime.async(function _callee13$(_context13) {
    while (1) {
      switch (_context13.prev = _context13.next) {
        case 0:
          playerId = req.params.id;
          playerPic = req.body.pfp_link;
          _context13.prev = 2;
          sql = "UPDATE players SET pfp_link = $2 WHERE player_id = $1";
          _context13.next = 6;
          return regeneratorRuntime.awrap(pool.query(sql, [playerId, playerPic]));

        case 6:
          databaseResult = _context13.sent;
          console.log(databaseResult);
          res.status(200).json({
            databaseResult: databaseResult
          });
          _context13.next = 14;
          break;

        case 11:
          _context13.prev = 11;
          _context13.t0 = _context13["catch"](2);
          res.status(500).json({
            message: "".concat(_context13.t0.message)
          });

        case 14:
        case "end":
          return _context13.stop();
      }
    }
  }, null, null, [[2, 11]]);
}); // Route to set a specific map's image

app.patch('/map/:id/image', function _callee14(req, res) {
  var mapId, mapImage, sql, databaseResult;
  return regeneratorRuntime.async(function _callee14$(_context14) {
    while (1) {
      switch (_context14.prev = _context14.next) {
        case 0:
          mapId = req.params.id;
          mapImage = req.body.map_img;
          _context14.prev = 2;
          sql = "UPDATE maps SET map_img = $2 WHERE map_id = $1";
          _context14.next = 6;
          return regeneratorRuntime.awrap(pool.query(sql, [mapId, mapImage]));

        case 6:
          databaseResult = _context14.sent;
          console.log(databaseResult);
          res.status(200).json({
            databaseResult: databaseResult
          });
          _context14.next = 14;
          break;

        case 11:
          _context14.prev = 11;
          _context14.t0 = _context14["catch"](2);
          res.status(500).json({
            message: "".concat(_context14.t0.message)
          });

        case 14:
        case "end":
          return _context14.stop();
      }
    }
  }, null, null, [[2, 11]]);
}); // Route to make specific game public

app.patch('/game/:id/public', function _callee15(req, res) {
  var gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee15$(_context15) {
    while (1) {
      switch (_context15.prev = _context15.next) {
        case 0:
          gameId = req.params.id;
          _context15.prev = 1;
          sql = "UPDATE games SET is_public = true WHERE game_id = $1";
          _context15.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context15.sent;
          console.log(databaseResult);
          res.status(200).json({
            databaseResult: databaseResult
          });
          _context15.next = 13;
          break;

        case 10:
          _context15.prev = 10;
          _context15.t0 = _context15["catch"](1);
          res.status(500).json({
            message: "".concat(_context15.t0.message)
          });

        case 13:
        case "end":
          return _context15.stop();
      }
    }
  }, null, null, [[1, 10]]);
}); // Route to make a specific game private

app.patch('/game/:id/private', function _callee16(req, res) {
  var gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee16$(_context16) {
    while (1) {
      switch (_context16.prev = _context16.next) {
        case 0:
          gameId = req.params.id;
          _context16.prev = 1;
          sql = "UPDATE games SET is_public = false WHERE game_id = $1";
          _context16.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context16.sent;
          console.log(databaseResult);
          res.status(200).json({
            databaseResult: databaseResult
          });
          _context16.next = 13;
          break;

        case 10:
          _context16.prev = 10;
          _context16.t0 = _context16["catch"](1);
          res.status(500).json({
            message: "".concat(_context16.t0.message)
          });

        case 13:
        case "end":
          return _context16.stop();
      }
    }
  }, null, null, [[1, 10]]);
}); // Route to get all the maps from the database

app.get('/maps', function _callee17(req, res) {
  var databaseResult;
  return regeneratorRuntime.async(function _callee17$(_context17) {
    while (1) {
      switch (_context17.prev = _context17.next) {
        case 0:
          _context17.prev = 0;
          _context17.next = 3;
          return regeneratorRuntime.awrap(pool.query("SELECT * FROM maps"));

        case 3:
          databaseResult = _context17.sent;
          console.log(databaseResult.rows);
          res.json({
            data: databaseResult.rows
          });
          _context17.next = 11;
          break;

        case 8:
          _context17.prev = 8;
          _context17.t0 = _context17["catch"](0);
          res.status(500).json({
            message: "".concat(_context17.t0.message)
          });

        case 11:
        case "end":
          return _context17.stop();
      }
    }
  }, null, null, [[0, 8]]);
}); // Route to get a specific map from the database

app.get('/maps/:id', function _callee18(req, res) {
  var mapId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee18$(_context18) {
    while (1) {
      switch (_context18.prev = _context18.next) {
        case 0:
          mapId = req.params.id;
          _context18.prev = 1;
          sql = "SELECT * FROM maps where map_id = $1";
          _context18.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [mapId]));

        case 5:
          databaseResult = _context18.sent;
          res.status(200).json({
            gameInfo: databaseResult.rows[0]
          });
          _context18.next = 12;
          break;

        case 9:
          _context18.prev = 9;
          _context18.t0 = _context18["catch"](1);
          res.status(500).json({
            message: "".concat(_context18.t0.message)
          });

        case 12:
        case "end":
          return _context18.stop();
      }
    }
  }, null, null, [[1, 9]]);
}); // Route to get all existing games from the database

app.get('/games', function _callee19(req, res) {
  var databaseResult;
  return regeneratorRuntime.async(function _callee19$(_context19) {
    while (1) {
      switch (_context19.prev = _context19.next) {
        case 0:
          _context19.prev = 0;
          _context19.next = 3;
          return regeneratorRuntime.awrap(pool.query("SELECT * FROM games"));

        case 3:
          databaseResult = _context19.sent;
          console.log(databaseResult.rows);
          res.json({
            data: databaseResult.rows
          });
          _context19.next = 11;
          break;

        case 8:
          _context19.prev = 8;
          _context19.t0 = _context19["catch"](0);
          res.status(500).json({
            message: "".concat(_context19.t0.message)
          });

        case 11:
        case "end":
          return _context19.stop();
      }
    }
  }, null, null, [[0, 8]]);
}); // Route to get a specific game's map 
// (Games table only obtains map_id so with this we can connect the map_id to the map_id in the maps table to obtain the map data)

app.get('/game/:id/map/:mapid', function _callee20(req, res) {
  var id, mapId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee20$(_context20) {
    while (1) {
      switch (_context20.prev = _context20.next) {
        case 0:
          id = req.params.id;
          mapId = req.params.mapid;
          _context20.prev = 2;
          sql = "SELECT * FROM maps join games on game_id = $1 where $2 = maps.map_id";
          _context20.next = 6;
          return regeneratorRuntime.awrap(pool.query(sql, [id, mapId]));

        case 6:
          databaseResult = _context20.sent;
          console.log(databaseResult);
          res.status(200).json({
            data: databaseResult.rows
          });
          _context20.next = 14;
          break;

        case 11:
          _context20.prev = 11;
          _context20.t0 = _context20["catch"](2);
          res.status(500).json({
            message: "".concat(_context20.t0.message)
          });

        case 14:
        case "end":
          return _context20.stop();
      }
    }
  }, null, null, [[2, 11]]);
});
app.get('/game/players/:playerid', function _callee21(req, res) {
  var playerId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee21$(_context21) {
    while (1) {
      switch (_context21.prev = _context21.next) {
        case 0:
          playerId = req.params.playerid;
          _context21.prev = 1;
          sql = "SELECT * FROM players join \"gamePlayers\" on players.player_id = $1 where $1 = \"gamePlayers\".player_id";
          _context21.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [playerId]));

        case 5:
          databaseResult = _context21.sent;
          console.log(databaseResult);
          res.status(200).json({
            data: databaseResult.rows
          });
          _context21.next = 13;
          break;

        case 10:
          _context21.prev = 10;
          _context21.t0 = _context21["catch"](1);
          res.status(500).json({
            message: "".concat(_context21.t0.message)
          });

        case 13:
        case "end":
          return _context21.stop();
      }
    }
  }, null, null, [[1, 10]]);
}); // Route to get a specific game from the database

app.get('/games/:id', function _callee22(req, res) {
  var gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee22$(_context22) {
    while (1) {
      switch (_context22.prev = _context22.next) {
        case 0:
          gameId = req.params.id;
          _context22.prev = 1;
          sql = "SELECT * FROM games where game_id = $1";
          _context22.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context22.sent;
          res.status(200).json({
            gameInfo: databaseResult.rows[0]
          });
          _context22.next = 12;
          break;

        case 9:
          _context22.prev = 9;
          _context22.t0 = _context22["catch"](1);
          res.status(500).json({
            message: "".concat(_context22.t0.message)
          });

        case 12:
        case "end":
          return _context22.stop();
      }
    }
  }, null, null, [[1, 9]]);
});
app.get('/games/:id/players', function _callee23(req, res) {
  var gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee23$(_context23) {
    while (1) {
      switch (_context23.prev = _context23.next) {
        case 0:
          gameId = req.params.id;
          _context23.prev = 1;
          sql = "SELECT * FROM \"gamePlayers\" where game_id = $1";
          _context23.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context23.sent;
          res.status(200).json({
            playerList: databaseResult.rows
          });
          _context23.next = 12;
          break;

        case 9:
          _context23.prev = 9;
          _context23.t0 = _context23["catch"](1);
          res.status(500).json({
            message: "".concat(_context23.t0.message)
          });

        case 12:
        case "end":
          return _context23.stop();
      }
    }
  }, null, null, [[1, 9]]);
});
app.get('/games/:id/players/playernames', function _callee24(req, res) {
  var gameId, sql, databaseResult;
  return regeneratorRuntime.async(function _callee24$(_context24) {
    while (1) {
      switch (_context24.prev = _context24.next) {
        case 0:
          gameId = req.params.id;
          _context24.prev = 1;
          sql = "SELECT players.username FROM players inner join \"gamePlayers\" on players.player_id = \"gamePlayers\".player_id where \"gamePlayers\".game_id = $1";
          _context24.next = 5;
          return regeneratorRuntime.awrap(pool.query(sql, [gameId]));

        case 5:
          databaseResult = _context24.sent;
          res.status(200).json({
            playerList: databaseResult.rows
          });
          _context24.next = 12;
          break;

        case 9:
          _context24.prev = 9;
          _context24.t0 = _context24["catch"](1);
          res.status(500).json({
            message: "".concat(_context24.t0.message)
          });

        case 12:
        case "end":
          return _context24.stop();
      }
    }
  }, null, null, [[1, 9]]);
}); // Route to get the players and have them ordered from games_won descending
// Return the player's username and the number of games won

app.get('/leaderboard', function _callee25(req, res) {
  var databaseResult;
  return regeneratorRuntime.async(function _callee25$(_context25) {
    while (1) {
      switch (_context25.prev = _context25.next) {
        case 0:
          _context25.prev = 0;
          _context25.next = 3;
          return regeneratorRuntime.awrap(pool.query("SELECT username, games_won FROM players ORDER BY games_won DESC"));

        case 3:
          databaseResult = _context25.sent;
          console.log(databaseResult);
          res.json({
            data: databaseResult.rows
          });
          _context25.next = 11;
          break;

        case 8:
          _context25.prev = 8;
          _context25.t0 = _context25["catch"](0);
          res.status(500).json({
            message: "".concat(_context25.t0.message)
          });

        case 11:
        case "end":
          return _context25.stop();
      }
    }
  }, null, null, [[0, 8]]);
});
app.get('/', function _callee26(req, res) {
  return regeneratorRuntime.async(function _callee26$(_context26) {
    while (1) {
      switch (_context26.prev = _context26.next) {
        case 0:
          console.log("hello");

        case 1:
        case "end":
          return _context26.stop();
      }
    }
  });
}); //socket Io server

var io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ['GET'],
    credentials: true
  }
}); //makes room code

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
};
var juice = {
  x: Math.floor(Math.random() * 1350) + 50,
  y: Math.floor(Math.random() * 700) + 50
}; // app.use(express.static(__dirname + '/public'));
// app.get('/', function (req, res) {
//   res.sendFile(__dirname + '/index.html');
// });

io.on('connection', function (socket) {
  console.log('a user connected'); // create a new player and add it to our players object

  players[socket.id] = {
    rotation: 0,
    x: Math.floor(Math.random() * 1350) + 50,
    y: Math.floor(Math.random() * 700) + 50,
    playerId: socket.id,
    playerScore: 0,
    team: Math.floor(Math.random() * 2) == 0 ? 'red' : 'blue'
  };
  currPlayers = Object.keys(players);
  numPlayers = currPlayers.length;
  console.log(currPlayers);
  console.log(numPlayers);
  players[socket.id]["playerNum"] = numPlayers;
  console.log(players);
  potato = {
    rotation: 0,
    x: Math.floor(Math.random() * 1350) + 50,
    y: Math.floor(Math.random() * 700) + 50
  }; // send the players object to the new player

  socket.emit('currentPlayers', players); // send the star object to the new player

  socket.emit('starLocation', star);
  socket.emit('starTwoLocation', starTwo);
  socket.emit('starThreeLocation', starThree);
  socket.emit('starFourLocation', starFour);
  socket.emit('starFiveLocation', starFive);
  socket.emit('starSixLocation', starSix);
  socket.emit('starSevenLocation', starSeven);
  socket.emit('starEightLocation', starEight);
  socket.emit('starNineLocation', starNine);
  socket.emit('starTenLocation', starTen); //socket.emit('star3Location', star3);

  socket.emit('potatoLocation', potato);
  socket.emit('potatoMovement', potato); //setTimeout(() => {  

  socket.emit('sandwichLocation', sandwich); //}, 5000);

  socket.emit('juiceLocation', juice); // send the current scores
  //theScore = players[socket.id].playerScore

  socket.emit('playerScoreUpdate', {
    theScore: players[socket.id].playerScore,
    playerNum: players[socket.id].playerNum
  }); // update all other players of the new player

  socket.broadcast.emit('newPlayer', players[socket.id]); // when a player disconnects, remove them from our players object

  socket.on('disconnect', function () {
    console.log('user disconnected'); // remove this player from our players object

    delete players[socket.id]; // emit a message to all players to remove this player

    io.emit('disconnected', socket.id);
  }); // when a player moves, update the player data

  socket.on('playerMovement', function (movementData) {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].rotation = movementData.rotation; // emit a message to all players about the player that moved

    socket.broadcast.emit('playerMoved', players[socket.id]);
  }); // socket.on('starCollected', function () {
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
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    star.x = Math.floor(Math.random() * 1350) + 50;
    star.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starLocation', star);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starTwoCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starTwo.x = Math.floor(Math.random() * 1350) + 50;
    starTwo.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starTwoLocation', starTwo);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starThreeCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starThree.x = Math.floor(Math.random() * 1350) + 50;
    starThree.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starThreeLocation', starThree);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starFourCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starFour.x = Math.floor(Math.random() * 1350) + 50;
    starFour.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starFourLocation', starFour);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starFiveCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starFive.x = Math.floor(Math.random() * 1350) + 50;
    starFive.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starFiveLocation', starFive);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starSixCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starSix.x = Math.floor(Math.random() * 1350) + 50;
    starSix.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starSixLocation', starSix);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starSevenCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starSeven.x = Math.floor(Math.random() * 1350) + 50;
    starSeven.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starSevenLocation', starSeven);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starEightCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starEight.x = Math.floor(Math.random() * 1350) + 50;
    starEight.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starEightLocation', starEight);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starNineCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starNine.x = Math.floor(Math.random() * 1350) + 50;
    starNine.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starNineLocation', starNine);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
  });
  socket.on('starTenCollected', function () {
    if (players[socket.id].playerNum == 1) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 2) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 3) {
      players[socket.id].playerScore += 10;
    } else if (players[socket.id].playerNum == 4) {
      players[socket.id].playerScore += 10;
    }

    starTen.x = Math.floor(Math.random() * 1350) + 50;
    starTen.y = Math.floor(Math.random() * 700) + 50;
    io.emit('starTenLocation', starTen);
    io.emit('playerScoreUpdate', {
      theScore: players[socket.id].playerScore,
      playerNum: players[socket.id].playerNum
    });
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
server.listen(3002, function () {
  console.log('Socket.io server is running ');
});
app.listen(PORT, function () {
  console.log("Listening on port ".concat(PORT));
});