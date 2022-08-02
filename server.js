const express = require('express');
const cors = require('cors');
const http = require('http')
const app = express();
const {Server} = require('socket.io')
const PORT = 3032;
const server = http.createServer(app)
app.use(express.json());
app.use(cors());

app.get('/', async(req, res) => {
    console.log("hello")
})
const io = new Server(server,{
    cors:{
        origin:"http://localhost:3000",
        methods:['GET'],
        credentials: true

    }
})
io.on('connection', (socket)=>{
console.log(`User connected ${socket.id}`)

// socket.on('send_message',(data)=>{
//     console.log(data)
   
//     socket.broadcast.emit('received_message', data)
// })
socket.on('join_room', (data)=>{
    socket.join(data)
})
socket.on('send_message', (data)=>{
    socket.to(data.room).emit('received_message', data)
})

})

server.listen(3002, ()=> {
    console.log('Socket.io server is running ')
   
})
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})