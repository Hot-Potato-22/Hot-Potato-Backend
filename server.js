const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3032;

app.use(express.json());
app.use(cors());

app.get('/', async(req, res) => {
    console.log("hello")
})

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})