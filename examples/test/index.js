const Pusher = require("pusher");
const PusherClient = require('pusher-client');
const venom = require('../../dist');

let channelStr = 'my-channel';

let sessions = {
    atlc: {
        initialized: false,
        client: null,
        sessionName: 'sessionName',//'atlc_session',
        pusher: {
            appId: '1477659',
            key: '198d42f2b4e9fd30cd5f',
            secret: 'f3b726b692eefc4f10ff',
            cluster: 'us2',
            useTLS: true
        },
        status: {},
        sent: [],
    },
    cte: {
        initialized: false,
        client: null,
        sessionName: 'cte_session',
        pusher: {
            appId: '1477660',
            key: '2dc50b6ee1bf55cabc51',
            secret: '376c5326e1685e135a4d',
            cluster: 'us2',
            useTLS: true
        },
        status: {},
        sent: [],
    },
}

Object.keys(sessions).forEach((key) => {
    let session = sessions[key];
    if (!session.initialized && !session.pusherC) {
        console.log('binding session: ' + key);
        session.initialized = true;
        session.pusherC = new PusherClient(session.pusher.key, { cluster: session.pusher.cluster });
        session.channel = session.pusherC.subscribe(channelStr);
        session.channel.bind('get-status', function(data) {
            console.log('get-status',data);
            if (session.status.status == 'qrReadFail') {
                session.status.asked = true;
            }
            sendStatus(session);
        });
        session.channel.bind('send-message', (data) => {
            console.log('send message', data);
            sendMessageWs(session,data);
        });
        session.channel.bind('disconnect', (data) => {
            console.log('disconnect', data);
            //ws.restartService();
            logout(session);
        });
        session.channel.bind('sendList', (data) => {
            console.log('disconnect', data);
            sendList(session,data);
        });
        session.pusher = new Pusher({
            appId: '1477659',
            key: '198d42f2b4e9fd30cd5f',
            secret: 'f3b726b692eefc4f10ff',
            cluster: 'us2',
            useTLS: true
        });
        session.status = {};
    }
});

const sendStatus = (session) => {
    if (session.status.asked) {
        vemonStart(session);
        session.status.asked = false;
    }
    session.pusher.trigger(channelStr, "status", session.status);
};
var ws = null;

const vemonStart = (session) => {
    venom
        .create(
            session.sessionName,
            (base64Qr, asciiQR, attempts, urlCode) => {
                const array = base64Qr.match(/.{1,8000}/g) || [];
                let string = (Math.random() + 1).toString(36).substring(7);
                array.forEach((val,index) => {
                    session.pusher.trigger(channelStr, "qr-code", {
                        key: string,
                        index: index,
                        base64: val,
                    });
                });
            },
            (statusSession, sessionUpdate) => {
                session.status = {
                    session_name: session.sessionName,
                    logged_to: sessionUpdate,
                    status: statusSession,
                };
                sendStatus(session);
                console.log('Status Session: ', statusSession);
                //return isLogged || notLogged || browserClose || qrReadSuccess || qrReadFail || autocloseCalled || desconnectedMobile || deleteToken || chatsAvailable || deviceNotConnected || serverWssNotConnected || noOpenBrowser || initBrowser || openBrowser || connectBrowserWs || initWhatsapp || erroPageWhatsapp || successPageWhatsapp || waitForLogin || waitChat || successChat
                //Create session wss return "serverClose" case server for close
                console.log('Session name: ', sessionUpdate);
            },{
                headless: false,
                autoClose: 0,
            }
        )
        .then((client) => {
            session.client = client;
            start(session);
        })
        .catch((erro) => {
            console.log(erro);
        });
}
Object.keys(sessions).forEach((key) => {
    let session = sessions[key];
    vemonStart(session);
});

function start(session) {
    session.client.onStreamChange((state) => {
        console.log('State Connection Stream: ' + state);
        session.status = {
            session_name: session.sessionName,
            status: state,
        };
        sendStatus(session);
    });
    session.client.onMessage((message) => {
      if (message.from != 'status@broadcast') {
          console.log(message);
      }
    if (message.body === '/status' && message.isGroupMsg === false) {
        session.client
        .sendText(message.from, 'Hello Dear')
        .then((result) => {
          console.log('Result: ', result); //return object success
        })
        .catch((erro) => {
          console.error('Error when sending: ', erro); //return object error
        });
    }
  });
}
const checkMessageId = (session, data) => {
    if (data.id) {
        if (!session.sent.includes(data.id)) {
            session.sent.push(data.id);
            if (session.sent.length > 5) {
                session.sent.shift();
            }
            return true;
        }
        return false;
    }
    return true;
}

const sendMessageWs = (session, data) => {
    console.log('sending message', data);
    let tf = checkMessageId(session, data);
    console.log(tf);
    if (!tf) {
        return;
    }
    let phone = data.phone + '@c.us';
    let text = data.text;
    let imgUrl = data.img_url;
    if (!session.client) {
        console.log('Sesión no iniciada');
        return;
    }
    if (!imgUrl) {
        session.client
            .sendText(phone, data.text)
            .then((result) => {
                console.log('Result: ', result); //return object success
            })
            .catch((erro) => {
                console.error('Error when sending: ', erro); //return object error
            });
        return;
    }
    let imageName = imgUrl.split('/')[imgUrl.split('/').length - 1]
    session.client
        .sendImage(
            phone,
            data.img_url,
            imageName,
            text
        )
        .then((result) => {
            console.log('Result: ', result); //return object success
        })
        .catch((erro) => {
            console.error('Error when sending: ', erro); //return object error
        });
}

async function logout(session) {
    if (!session.client) {
        console.log('Sesión no iniciada');
        return;
    }
    await session.client.logout()
        .then((result) => {
            console.log('Result: ', result); //return object success
            session.client.close()
                .then((result) => {
                    console.log('Result: ', result); //return object success
                })
                .catch((erro) => {
                    console.error('Error when sending: ', erro); //return object error
                });
            process.exit();
        })
        .catch((erro) => {
            console.error('Error when sending: ', erro); //return object error
        });
}

async function sendList(session, data) {
    if (!session.client) {
        console.log('Sesión no iniciada');
        return;
    }
    const list = [
        {
            title: "Pasta",
            rows: [
                {
                    title: "Ravioli Lasagna",
                    description: "Made with layers of frozen cheese",
                }
            ]
        },
        {
            title: "Dessert",
            rows: [
                {
                    title: "Baked Ricotta Cake",
                    description: "Sweets pecan baklava rolls",
                },
                {
                    title: "Lemon Meringue Pie",
                    description: "Pastry filled with lemonand meringue.",
                }
            ]
        }
    ];

    await session.client.sendListMenu('584165831231@c.us', 'Title', 'subTitle', 'Description', 'menu', list)
        .then((result) => {
            console.log('Result: ', result); //return object success
        })
        .catch((erro) => {
            console.error('Error when sending: ', erro); //return object error
        });
}

// Catch ctrl+C
process.on('SIGINT', function() {
    //ws.close();
});