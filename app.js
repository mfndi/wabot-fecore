const express = require('express');
const qrcode = require('qrcode'); 
const socketIo = require('socket.io');
const http = require('http');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const { response } = require('express');
const {body, validationResult } = require('express-validator');
const { phoneNumberFormatter } = require('./Helpers/formatter.js');



const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({extended: true}));


// Use the saved values
const client = new Client({
    puppeteer: { headless: true, args: [
        '--no-sandbox',
        '--unhandled-rejections=strict',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
        ], }, 
    authStrategy: new LocalAuth({
        clientId: "client-one",
        
    })
});





app.get('/', (req, res) => {
    res.sendFile('/index.html', {root: __dirname });
});



client.on('message', msg =>{
    console.log(msg.body);
})


client.on('message', msg => {
    if(msg.body === '!ping'){
        client.sendMessage(msg.from, 'pong');
    }
})

client.initialize();


//socket io
io.on('connection', function(socket){
    socket.emit('message', 'Whatsapp dah siap...');

    client.on('qr', qr => {
        console.log('QR TERSEDIA' , qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR CODE SUDAH BISA DI SCAN');
        });
    });


    client.on('ready', () => {
        socket.emit('message', 'Whatsapp is ready')
    });


    client.on('authenticated', (session) => {    
        console.log(session);
      socket.emit('authenticated', 'Whatasapp is authenticated');
      socket.emit('message', 'Whatasapp is authenticated');
    });

});


//buat pengecekan nomor udah terdaftar atau belum
const cekNomor =  async function(number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}


//send message 
app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty(),
] ,async (req, res) => {
    
    //ubah format whatsapp
    const errors = validationResult(req).formatWith(({ msg }) =>{
        return msg;
    });

    if(!errors.isEmpty()){
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        });
    }
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;


    //cek nomor hp sebelum mengirim
    const isRegister = await cekNomor(number);
    if(!isRegister){
        return res.status(422).json({
            status: false,
            message: 'Nomor Belum terdaftart'
        })
    }

    client.sendMessage(number, message).then(response =>{
            res.status(200).json({
                status: true,
                response: response
            });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: response
        });
    })
});






//send media
app.post('/send-media' ,(req, res) => {

    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.message;
    const media = MessageMedia.fromFilePath('./hog.png');

    client.sendMessage(number, media, {caption: caption}).then(response =>{
            res.status(200).json({
                status: true,
                response: response
            });
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: response
        });
    })
});


server.listen(8000, function(){
    console.log('App Running on' + 8000);
});
