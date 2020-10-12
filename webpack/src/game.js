import $ from 'jquery';
import seedrandom from 'seedrandom';
import MessageBus from 'message-bus-client';

import die from './die';
import Board from './board';

const dice = [];
const board = new Board();

MessageBus.baseUrl = `${location.pathname}/`;

MessageBus.subscribe(location.pathname, message => {
    console.log("Received message:", message);

    if (message.action == 'reset') {
        $('#queue').empty();
        dice.forEach(die => board.remove(die));
        dice.splice(0, dice.length);
    } else if (message.action == 'pull') {      
        $('#queue').append(
            $('<div>', { class: 'queued' }).append(
                $('<i>', { class: 'fa fa-dice-d6' }).css('color', message.color)
            )
        );
    } else if (message.action == 'roll') {
        $('#queue').empty();

        message.dice.forEach(specs => {
            const body = board.add(die(specs.color));
            body.dieID = specs.id;

            body.mesh.on('click', event => {          
                if (event.data.originalEvent.shiftKey) {
                    console.log(event.target);
                } else {
                    $.post(location.pathname, { action: 'reroll', id: specs.id })
                }
            });

            body.position.set(6,5,3);
            body.linearVelocity.set(50, 0, 50);

            const random = seedrandom(specs.id);
            body.angularVelocity.set(random()*50, random()*50, random()*50);
            
            dice.push(body);
        });

    } else if (message.action == 'remove') {
        board.remove(dice.find(die => die.dieID == message.id));
    }
});

$('#reset').click(() => {
    $.post(location.pathname, { action: 'reset' });
});

$('#pull').click(() => {
    $.post(location.pathname, { action: 'pull' });
});

$('#roll').click(() => {
    $.post(location.pathname, { action: 'roll' }, newDiceIds => {
        // diceWithUnknownPositions = newDiceIds;
    });
});