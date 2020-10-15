import $ from 'jquery';
import seedrandom from 'seedrandom';
import MessageBus from 'message-bus-client';

import die from './die';
import Board from './board';

const UP = new THREE.Vector3(0,1,0);

const NORMALS = [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, 1)
];

const dice = {};
const messages = [];
const board = new Board();

let active = false;
let processing = false;

MessageBus.baseUrl = `${location.pathname}/`;

setInterval(() => {
    if (processing) {
        return; 
    }

    // disable MessageBus when tab is inactive to work around this: 
    // https://github.com/discourse/message_bus/issues/238
    if (active && document.hidden) {
        active = false;
        MessageBus.stop();
        MessageBus.unsubscribe(location.pathname);
    }

    if (!active && !document.hidden) {
        active = true;
        MessageBus.start();
        MessageBus.subscribe(location.pathname, m => messages.push(m), -2);
    }

    if (messages.length == 0) {
        return; 
    }

    // since messages contain the entire games state, 
    // we only need the most recent message
    const message = messages.pop();
    messages.splice(0, messages.length);

    // update the queue
    $('#queue').empty();

    message.queue.forEach(color => {
        $('#queue').append(
            $('<div>', { class: 'queued' }).append(
                $('<i>', { class: 'fa fa-dice-d6' }).css('color', color)
            )
        );
    });

    Object.keys(dice).forEach(id => {
        // this die is already on the board 
        if (message.board[id]) {
            delete message.board[id]
        } 
        
        // this die is no longer on the board
        else {
            board.remove(dice[id]);
            delete dice[id];
        }
    });

    // roll the remaining dice
    if (Object.keys(message.board).length) {
        console.log('simulating dice roll');
        $('#nav').hide();
        processing = true;
        
        for (const [id, entry] of Object.entries(message.board)) {
            const random = seedrandom(id);

            dice[id] = board.add({
                size: [1,1,1], pos: [0,-1,0], move: true, mesh: null
            });

            dice[id].position.set(random()*8-4, 7, 3);
            dice[id].linearVelocity.set(random()*50-25, 0, random()*50-25);
            dice[id].angularVelocity.set(random()*10, random()*10, random()*10);            
        }

        const running = setInterval(() => {
            board.fastForward(100);

            if (Object.values(dice).every(die => die.isStatic || die.sleeping)) {
                clearInterval(running);
                console.log('simulation complete');

                for (const [id, specs] of Object.entries(message.board)) {
                    const simulatedDie = dice[id];

                    const angles = NORMALS.map(n => 
                        n.clone().applyQuaternion(simulatedDie.quaternion).angleTo(UP)
                    );
                    
                    const upside = angles.indexOf(Math.max(...angles));
                    let shift = upside - specs.face;
                    
                    if (shift < 0) {
                        shift += 6;
                    }

                    simulatedDie.remove();
                    const random = seedrandom(id);
                    dice[id] = board.add(die(specs.color, shift));

                    dice[id].position.set(random()*8-4, 7, 3);
                    dice[id].linearVelocity.set(random()*50-25, 0, random()*50-25);
                    dice[id].angularVelocity.set(random()*10, random()*10, random()*10);
                }

                const freeze = setInterval(() => {
                    if (Object.values(dice).every(die => die.isStatic || die.sleeping)) {
                        clearInterval(freeze);
            
                        // all this nonsense is because Oimo has no 
                        // way to make a dynamic body static :-(
                        for (const [id, die] of Object.entries(dice)) {
                            const mesh = die.mesh;
                            const position = mesh.position.toArray();
                            const orientation = die.orientation;
                            
                            die.remove();
            
                            dice[id] = board.add({
                                size: [1,1,1], pos: position, mesh: null
                            });
            
                            dice[id].orientation = orientation;
                            dice[id].mesh = mesh;
            
                            dice[id].mesh.on('click', event => {          
                                if (event.data.originalEvent.shiftKey) {
                                    console.log(event.target);
                                } else {
                                    $.post(location.pathname, { action: 'reroll', id: id })
                                }
                            });
                        }
            
                        $('#nav').show();
                        processing = false;
                    }
                }, 100);
            }
        }, 100);
    }
}, 250);

$('#reset').click(() => {
    $.post(location.pathname, { action: 'reset' });
});

$('#pull').click(() => {
    if ($('.queued').length < 3) {
        $.post(location.pathname, { action: 'pull' });
    }
});

$('#roll').click(() => {
    if ($('.queued').length > 0) {
        $.post(location.pathname, { action: 'roll' });
    }
});