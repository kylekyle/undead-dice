import $ from 'jquery';
import seedrandom from 'seedrandom';
import MessageBus from 'message-bus-client';

import die from './die';
import Board from './board';

const dice = {};
const board = new Board();
const UP = new THREE.Vector3(0,1,0);

const NORMALS = [
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, 1)
];

const addDieToQueue = color => {
    $('#queue').append(
        $('<div>', { class: 'queued' }).append(
            $('<i>', { class: 'fa fa-dice-d6' }).css('color', color)
        )
    );
};

const addDieToScene = specs => {
    const body = die(specs.color, specs.shift);    
    dice[specs.id] = board.add(body);

    dice[specs.id].mesh.on('click', event => {          
        if (event.data.originalEvent.shiftKey) {
            console.log(event.target);
        } else {
            $.post(location.pathname, { action: 'reroll', id: specs.id })
        }
    });

    return dice[specs.id];
}

const freezeDice = () => {
    const done = setInterval(() => {
        if (Object.values(dice).every(die => die.isStatic || die.sleeping)) {
            clearInterval(done);

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
            }

            $('#nav').show();
        }
    }, 100);
}

$('script[data-queue]').data('queue').forEach(addDieToQueue);

const state = $('script[data-board]').data('board');

for (const [id, specs] of Object.entries(state)) {
    specs.shift = 2 - specs.face;

    if (specs.shift < 0) {
        specs.shift += 6;
    }

    const body = addDieToScene(specs);
    body.orientation.setFromEuler(0,Math.random()*180,0)
    body.position.set(Math.random()*14-7,1,Math.random()*8-4);
    board.fastForward(100);
    
    freezeDice();
}

MessageBus.baseUrl = `${location.pathname}/`;

MessageBus.subscribe(location.pathname, message => {
    console.log("Received message:", message);

    if (message.action == 'reset') {
        $('#queue').empty();
        for(const id in dice) {
            board.remove(dice[id]);
            delete dice[id];
        }
    } else if (message.action == 'pull') {      
        addDieToQueue(message.color);
    } else if (message.action == 'roll') {
        $('#nav').hide();
        $('#queue').empty();

        // simulate a roll
        const simulatedDice = message.dice.map((specs, i) => {
            console.log('simulating dice roll');

            const random = seedrandom(specs.id);
            const body = board.add({
                size: [1,1,1], pos: [0,-1,0], move: true, mesh: null
            });

            body.position.set(i, 7, 3);
            body.linearVelocity.set(random()*50-25, 0, random()*50-25);
            body.angularVelocity.set(random()*10, random()*10, random()*10);
            
            return body;
        });

        const simulation = setInterval(() => {
            board.fastForward(100);

            if (simulatedDice.every(die => die.sleeping)) {
                clearInterval(simulation);
                console.log('simulation complete');

                simulatedDice.forEach((die, i) => {
                    const specs = message.dice[i];
                    
                    const angles = NORMALS.map(n => 
                        n.clone().applyQuaternion(die.quaternion).angleTo(UP)
                    );
                    
                    const upside = angles.indexOf(Math.max(...angles));
                    specs.shift = upside - specs.face;
                    
                    if (specs.shift < 0) {
                        specs.shift += 6;
                    }

                    board.remove(die);
                });
                
                const newDice = message.dice.map((specs, i) => {
                    const body = addDieToScene(specs);
                    const random = seedrandom(specs.id);
                    
                    body.position.set(i, 7, 3);
                    body.linearVelocity.set(random()*50-25, 0, random()*50-25);
                    body.angularVelocity.set(random()*10, random()*10, random()*10);
                    
                    return body;
                });

                freezeDice();
            }
        }, 100);

    } else if (message.action == 'remove') {
        board.remove(dice[message.id]);
        delete dice[message.id];
    }
});

$('#reset').click(() => {
    $.post(location.pathname, { action: 'reset' });
});

$('#pull').click(() => {
    if ($('.queued').length < 3) {
        $.post(location.pathname, { action: 'pull' });
    }
});

$('#roll').click(() => {
    $.post(location.pathname, { action: 'roll' });
});