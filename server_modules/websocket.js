const xssFilters = require('xss-filters');
function websocket(server) {
    const io = require('socket.io')(server);
    const Message = require('../models/message')
    const users = {}
    
    io.on('connection', function (socket) {
      //监听用户发布聊天内容
      console.log('socket connect!');      
      socket.on('message', function (obj) {
        console.log('socket message!'); 
        //向所有客户端广播发布的消息
        if(!obj.msg) {
          return;
        }
        // 后端限制字符长度
        const msgLimit = obj.msg.slice(0, 200); 
        const mess = {
          username: obj.username,
          src: obj.src,
          msg: xssFilters.inHTMLData(msgLimit),
          img: obj.img, // 防止xss
          roomid: obj.room,
          time: obj.time
        }
        io.to(mess.roomid).emit('message', mess)
        global.logger.info(obj.username + '对房' + mess.roomid+'说：'+ mess.msg)
        if (obj.img === '') {
          const message = new Message(mess)
          message.save(function (err, mess) {
            if (err) {
              global.logger.error(err)
            }
            global.logger.info(mess)
          })
        }
      })
      socket.on('login',function (obj) {
        console.log('socket login!');
        if (!obj.name) {
          return;
        }
        socket.name = obj.name
        socket.room = obj.roomid
        if (!users[obj.roomid]) {
          users[obj.roomid] = {}
        }
        users[obj.roomid][obj.name] = obj
        socket.join(obj.roomid)
        io.to(obj.roomid).emit('login', users[obj.roomid])
        global.logger.info(obj.name + '加入了' + obj.roomid)
      })
      socket.on('logout',function (obj) {
        try{
          console.log('socket loginout!');
          const is = Object.hasOwnProperty.call(users[obj.roomid], obj.name)
          if (is) {
            delete users[obj.roomid][obj.name]
            global.logger.info(obj.name + '退出了' + obj.roomid)
            io.to(obj.roomid).emit('logout', users[obj.roomid])
            socket.leave(obj.roomid)
          }
        } catch (e) {
          global.logger.error(e)
        }
      })
    
      socket.on('disconnect', function (e) {
        // console.log(e);
        console.log('socket disconnect!');
        console.log(socket.room, socket.name);
        if (users[socket.room] && users[socket.room].hasOwnProperty(socket.name)) {
          delete users[socket.room][socket.name]
          // 用户监听用退出聊天室
          global.logger.info(socket.name + '退出了' + socket.room)
          socket.leave(socket.roomid)
          io.to(socket.room).emit('logout', users[socket.room])
        }
      })
    })
}

module.exports = websocket