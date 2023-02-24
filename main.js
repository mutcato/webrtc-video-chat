let APP_ID = "444d**e29";
let token = null;
let uid = String(Math.floor(Math.random() * 10000))
let client;
let channel;
let urlParams = new URLSearchParams(window.location.search)
let roomId = urlParams.get("room")

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
        }
    ]
}

let init = async () => { 
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})
    channel = client.createChannel(roomId)
    await channel.join()
    channel.on("MemberJoined", handleUserJoined)
    client.on("MessageFromPeer", handleMessageFromPeer)
    client.on("MemberLeft", handleUserLeft)

    await createOffer()
}

let handleMessageFromPeer = async(message, userId) => {
    message = JSON.parse(message.text)

    if(message.type === "offer"){
        createAnswer(message.offer, userId)
    }else if(message.type === "answer"){
        addAnswer(message.answer)
    }else if(message.type === "candidate"){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

let handleUserJoined = async(userId) => {
    console.log("User joined: ", userId)
    createOffer(userId)
}

let createPeerConnection = async(userId) => {
    peerConnection = new RTCPeerConnection(servers)
    remoteStream = new MediaStream()
    document.getElementById("user-2").srcObject = remoteStream
    document.getElementById("user-2").style.display = "block"

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true})
        document.getElementById("user-1").srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text: JSON.stringify({"type": "candidate", "candidate": event.candidate})}, userId)
        }
    }
}

let createOffer = async (userId) => {
    await createPeerConnection(userId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text: JSON.stringify({"type": "offer", "offer": offer})}, userId)
}


let createAnswer = async(offer, userId) => {
    await createPeerConnection(userId)

    await peerConnection.setRemoteDescription(offer)
    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text: JSON.stringify({"type": "answer", "answer": answer})}, userId)
}

let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

let handleUserLeft = async(userId) => {
    document.getElementById("user-2").style.display = "none"
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

window.addEventListener('beforeunload', leaveChannel);

(async()=>{await init()})()