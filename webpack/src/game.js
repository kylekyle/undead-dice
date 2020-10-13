import $ from 'jquery';
import seedrandom from 'seedrandom';
import MessageBus from 'message-bus-client';

import die from './die';
import Board from './board';

const dice = {};
let update = false;
const board = new Board();

const addDieToQueue = color => {
    $('#queue').append(
        $('<div>', { class: 'queued' }).append(
            $('<i>', { class: 'fa fa-dice-d6' }).css('color', color)
        )
    );
};

const addDieToScene = (id, color) => {
    dice[id] = board.add(die(color));

    dice[id].mesh.on('click', event => {          
        if (event.data.originalEvent.shiftKey) {
            console.log(event.target);
        } else {
            $.post(location.pathname, { action: 'reroll', id: id })
        }
    });

    return dice[id];
}

$('script[data-queue]').data('queue').forEach(addDieToQueue);

const state = $('script[data-board]').data('board');

for (const [id, params] of Object.entries(state)) {
    if (params.position && params.quaternion) {
        const die = addDieToScene(id, params.color);
        die.position.set(...params.position);
        die.orientation.set(...params.quaternion);
    } else {
        console.log(`Error: die ${id} has no position information!`);
    }
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
        $('#queue').empty();

        message.dice.forEach(specs => {
            const body = addDieToScene(specs.id, specs.color);

            body.position.set(6,5,3);
            body.linearVelocity.set(50, 0, 50);

            const random = seedrandom(specs.id);
            body.angularVelocity.set(random()*50, random()*50, random()*50);
        });

        // if we rolled the dice, then we update the server 
        // with their positions
        if (update) { 
            const interval = setInterval(() => {
                if (Object.values(dice).every(die => die.sleeping)) {
                    update = false;
                    clearInterval(interval);
                    console.log("Updating server with dice positions");
                    
                    for (const [id, die] of Object.entries(dice)) {
                        $.post(location.pathname, {
                            id: id,
                            action: 'diePositionReport',
                            position: die.mesh.position.toArray(),
                            quaternion: die.mesh.quaternion.toArray()
                        });
                    }
                }
            }, 1000);
        }

    } else if (message.action == 'remove') {
        board.remove(dice[message.id]);
        delete dice[message.id];
    }
});

$('#reset').click(() => {
    $.post(location.pathname, { action: 'reset' });
});

$('#pull').click(() => {
    $.post(location.pathname, { action: 'pull' });
});

$('#roll').click(() => {
    update = true;
    $.post(location.pathname, { action: 'roll' });
});