const express = require('express');
const socketio = require('socket.io');
const path = require('path');
const http = require('http');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app);

const io = socketio(server);

const publicDirectoryPath = path.join(__dirname, '../public');
app.use(express.static(publicDirectoryPath));


io.on('connection', (socket) => {
    socket.on('join', ({ username, room }, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room });

        if (error) {
            return callback(error);
        }
        socket.join(user.room);

        socket.emit('message', generateMessage('Admin', 'Welcome to the Chat App'));

        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined`));

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback();
    })


    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed');
        }

        io.to(user.room).emit('message', generateMessage(user.username, message));

        callback();
    });


    socket.on('sendLocation', (coords, ackCallback) => {
        const user = getUser(socket.id);

        io
            .to(user.room)
            .emit(
                'locationMessage',
                generateLocationMessage(
                    user.username,
                    `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
                )
            );

        ackCallback();
    })


    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    });
});


const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`Server is up on PORT ${port}`);
})
