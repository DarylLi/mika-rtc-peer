//@ts-nocheck

function PeerTest() {
    const [answer, setAnswer] = useState(null);
    window.onCall = false;
    window.pendingOther = false;
    window.joinOther = false;
    let offerList = [];
    let offerDesc = null;
    let remoteDesc = null;
    let localStream;
    let pc1;
    let pc2;
    const offerOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
    };

    const curId = `${new Date().getTime()}`;
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://webrtc.github.io/adapter/adapter-latest.js';
        console.log(document.body);
        document.body.appendChild(script);
    }, []);
    useEffect(() => {
        let ws = new WebSocket('wss://daryl.cn:3000');
        ws.onopen = () => {
            console.log('start!!!');
        };
        ws.addEventListener('message', async function (event) {
            //console.log(`Received message:${JSON.parse(event.data).type},${event.data}`);
            if (JSON.parse(event.data).type === 'offerList') {
                // if (JSON.parse(event.data).data.data.length === 0) return;
                // console.log(JSON.parse(event.data).data.data);
                offerList = JSON.parse(event.data).data.data.filter(
                    (e) => e.uid !== curId
                );
                // if (answerDes && answerDes.uid !== curId) {
                //     !answer && setAnswer(answerDes.desc);
                //     await loadFromRemotePc2(answerDes.desc);
                // }
            } else if (JSON.parse(event.data).type === 'someonejoined') {
                await pc1.setRemoteDescription(
                    JSON.parse(event.data).data.desc
                );
                // ws.send(  //更新列表
                //     JSON.stringify({
                //         type: 'finish',
                //         data: {
                //             uid: JSON.parse(event.data).data.uid,
                //             sdp: offer
                //         }
                //     })
                // );
            }
        });

        // ws.onmessage(()=>{});
        const startButton = document
            .getElementById('previewFrame')
            .shadowRoot.getElementById('startButton');
        const callButton = document
            .getElementById('previewFrame')
            .shadowRoot.getElementById('callButton');
        const hangupButton = document
            .getElementById('previewFrame')
            .shadowRoot.getElementById('hangupButton');
        const joinButton = document
            .getElementById('previewFrame')
            .shadowRoot.getElementById('joinButton');
        callButton.disabled = true;
        hangupButton.disabled = true;
        joinButton.disabled = true;
        !!startButton && startButton.addEventListener('click', start);
        !!callButton && callButton.addEventListener('click', call);
        !!hangupButton && hangupButton.addEventListener('click', hangup);
        !!joinButton && joinButton.addEventListener('click', join);

        let startTime;
        const localVideo = document
            .getElementById('previewFrame')
            .shadowRoot.getElementById('localVideo');
        const remoteVideo = document
            .getElementById('previewFrame')
            .shadowRoot.getElementById('remoteVideo');

        localVideo &&
            localVideo.addEventListener('loadedmetadata', function () {
                console.log(
                    `Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
                );
            });

        remoteVideo &&
            remoteVideo.addEventListener('loadedmetadata', function () {
                console.log(
                    `Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
                );
            });

        remoteVideo &&
            remoteVideo.addEventListener('resize', () => {
                console.log(
                    `Remote video size changed to ${remoteVideo.videoWidth}x${
                        remoteVideo.videoHeight
                    } - Time since pageload ${performance.now().toFixed(0)}ms`
                );
                // We'll use the first onsize callback as an indication that video has started
                // playing out.
                if (startTime) {
                    const elapsedTime = window.performance.now() - startTime;
                    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
                    startTime = null;
                }
            });

        function getName(pc) {
            return pc === pc1 ? 'pc1' : 'pc2';
        }

        function getOtherPc(pc) {
            return pc === pc1 ? pc2 : pc1;
        }

        async function start() {
            console.log('Requesting local stream');
            startButton.disabled = true;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                });
                console.log('Received local stream');
                localVideo.srcObject = stream;
                localVideo.playsInline = true;
                localVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.autoplay = true;

                localStream = stream;
                joinButton.disabled = false;
                callButton.disabled = false;
            } catch (e) {
                alert(`getUserMedia() error: ${e.name}`);
            }
        }
        //发起视频通话
        async function call() {
            callButton.disabled = true;
            hangupButton.disabled = false;
            console.log('Starting call');
            window.onCall = true;
            startTime = window.performance.now();
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            if (videoTracks.length > 0) {
                console.log(`Using video device: ${videoTracks[0].label}`);
            }
            if (audioTracks.length > 0) {
                console.log(`Using audio device: ${audioTracks[0].label}`);
            }
            const configuration = {};
            // const configuration = {iceServers: [{urls: "stun:stun.l.google.com:19302"}]};
            console.log('RTCPeerConnection configuration:', configuration);
            pc1 = new RTCPeerConnection(configuration);
            pc1.addEventListener('icecandidate', (e) => onIceCandidate(pc1, e));
            pc1.addEventListener('iceconnectionstatechange', (e) =>
                onIceStateChange(pc1, e)
            );
            pc1.addEventListener('track', gotRemoteStream);
            console.log('Created local peer connection object pc1');
            localStream
                .getTracks()
                .forEach((track) => pc1.addTrack(track, localStream));
            console.log('Added local stream to pc1  ！');
            try {
                console.log('pc1 createOffer start');
                window.pendingOther = true;
                const offer = await pc1.createOffer(offerOptions);
                await onCreateOfferSuccess(offer);
                // 等待ICE收集完成
                await new Promise((resolve) => {
                    if (pc1.iceGatheringState === 'complete') {
                        resolve();
                    } else {
                        pc1.onicegatheringstatechange = () => {
                            if (pc1.iceGatheringState === 'complete') {
                                resolve();
                            }
                        };
                    }
                });
                ws.send(
                    JSON.stringify({
                        type: 'call',
                        data: {
                            uid: curId,
                            sdp: pc1.localDescription
                        }
                    })
                );
                // 等候answer介入
            } catch (e) {
                onCreateSessionDescriptionError(e);
            }
        }
        //加入视频通话，目前随机加入
        async function join() {
            //匹配最新的加入
            if (offerList.length === 0) return;
            const desc = offerList[0].desc;

            callButton.disabled = true;
            hangupButton.disabled = false;
            console.log('Starting join');
            window.onCall = true;
            startTime = window.performance.now();
            const videoTracks = localStream.getVideoTracks();
            const audioTracks = localStream.getAudioTracks();
            if (videoTracks.length > 0) {
                console.log(`Using video device: ${videoTracks[0].label}`);
            }
            if (audioTracks.length > 0) {
                console.log(`Using audio device: ${audioTracks[0].label}`);
            }
            const configuration = {};
            // const configuration = {iceServers: [{urls: "stun:stun.l.google.com:19302"}]};
            console.log('RTCPeerConnection configuration:', configuration);
            pc1 = new RTCPeerConnection(configuration);
            // pc1.addEventListener('icecandidate', (e) => onIceCandidate(pc1, e));
            pc1.addEventListener('iceconnectionstatechange', (e) =>
                onIceStateChange(pc1, e)
            );
            pc1.addEventListener('track', gotRemoteStream);
            console.log('Created local peer connection object pc1', desc);
            //介入offer
            await pc1.setRemoteDescription(new RTCSessionDescription(desc));

            localStream
                .getTracks()
                .forEach((track) => pc1.addTrack(track, localStream));
            console.log('Added local stream to pc1  ！');
            try {
                console.log('pc1 createOffer start');
                window.pendingOther = true;
                const answer = await pc1.createAnswer();
                remoteDesc = desc;
                await onCreateAnswerSuccess(answer);
                // // 等待ICE收集完成
                await new Promise((resolve) => {
                    if (pc1.iceGatheringState === 'complete') {
                        resolve();
                    } else {
                        pc1.onicegatheringstatechange = () => {
                            if (pc1.iceGatheringState === 'complete') {
                                resolve();
                            }
                        };
                    }
                });
                ws.send(
                    JSON.stringify({
                        type: 'join',
                        data: {
                            uid: curId,
                            sdp: pc1.localDescription,
                            ip: offerList[0].ip
                        }
                    })
                );
                // await loadFromRemotePc2(offer);
            } catch (e) {
                onCreateSessionDescriptionError(e);
            }
        }
        function onCreateSessionDescriptionError(error) {
            console.log(
                `Failed to create session description: ${error.toString()}`
            );
        }

        async function onCreateOfferSuccess(desc) {
            // console.log(`Offer from pc1\n${desc.sdp}`);
            offerDesc = desc;
            console.log('pc1 setLocalDescription start!');
            try {
                await pc1.setLocalDescription(desc);
                onSetLocalSuccess(pc1);
            } catch (e) {
                onSetSessionDescriptionError();
            }
        }

        function onSetLocalSuccess(pc) {
            console.log(`${getName(pc)} setLocalDescription complete`);
        }

        function onSetRemoteSuccess(pc) {
            console.log(`${getName(pc)} setRemoteDescription complete`);
        }

        function onSetSessionDescriptionError(error) {
            console.log(`Failed to set session description: }`);
        }

        function gotRemoteStream(e) {
            if (remoteVideo.srcObject !== e.streams[0]) {
                remoteVideo.srcObject = e.streams[0];
                console.log('pc2 received remote stream');
            }
        }

        async function onCreateAnswerSuccess(desc) {
            console.log('pc1 setLocalDescription start');
            try {
                await pc1.setLocalDescription(desc);
            } catch (e) {
                onSetSessionDescriptionError(e);
            }
        }

        async function onIceCandidate(pc, event) {
            try {
                await pc.addIceCandidate(event.candidate);
                onAddIceCandidateSuccess(pc);
            } catch (e) {
                onAddIceCandidateError(pc, e);
            }
            console.log(
                `${getName(pc)} ICE candidate:\n${
                    event.candidate ? event.candidate.candidate : '(null)'
                }`
            );
        }

        function onAddIceCandidateSuccess(pc) {
            console.log(`${getName(pc)} addIceCandidate success`);
        }

        function onAddIceCandidateError(pc, error) {
            console.log(
                `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
            );
        }

        function onIceStateChange(pc, event) {
            if (pc) {
                console.log(
                    `${getName(pc)} ICE state: ${pc.iceConnectionState}`
                );
                console.log('ICE state change event: ', event);
            }
        }

        function hangup() {
            window.onCall = false;
            console.log('Ending call');
            pc1.close();
            pc2.close();
            pc1 = null;
            pc2 = null;
            hangupButton.disabled = true;
            callButton.disabled = false;
            joinButton.disabled = false;
        }
    }, []);
    return (
        <div>
            <video id="localVideo" playsinline autoplay muted></video>
            <video id="remoteVideo" playsinline autoplay></video>
            <Button id="startButton">start</Button>
            <Button id="callButton">call</Button>
            <Button id="joinButton">join</Button>
            <Button id="hangupButton">hangup</Button>
        </div>
    );
}

export default PeerTest;
