const express = require('express');
const app = express();
const http = require('http')
const {Server} = require("socket.io")
const cors = require('cors')

app.use(cors())

const server = http.createServer(app) 
let PORT = 3002

const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      handlePreflightReq: (req,res) =>{
res.writeHead(200, {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET,POST",
    "Access-Control-Allow-Headers": "my-custom-heading",
    "Access-Control-Allow-Credentials": true
})
      }
    },
  });

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`)
});

server.listen(PORT,()=>{
    console.log(`Server is running on port: ${PORT}`)
} )