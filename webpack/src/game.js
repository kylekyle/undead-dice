import createDie from './die';

import $ from 'jquery';
import * as THREE from 'three';
import * as CANNON from 'cannon';
import { Interaction } from 'three.interaction';

import OrbitControls from 'orbit-controls-es6';
import AleaRandom from 'seedrandom/lib/alea';
import MessageBus from 'message-bus-client';

MessageBus.baseUrl = `${location.pathname}/`;

// TODO: delete this
window.$ = $;

function add_plane(scene, world) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 50, 10, 10),
    new THREE.MeshPhongMaterial({color: 0xd0d0d0})
  );

  plane.rotation.x = -Math.PI * 0.5;
  plane.receiveShadow = true;
  scene.add(plane);

  world.add(new CANNON.Body({
    shape: new CANNON.Plane(),
    mass: 0,
    quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI * 0.5, 0, 0)
  }));
}

function add_light(scene) {
  // const light = new THREE.DirectionalLight(0xffffff);
  // light.position.set(0, 1, 1).normalize();
  // scene.add(light);
  // scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  let ambient = new THREE.AmbientLight("#ffffff", 0.3);
  scene.add(ambient);

	let directionalLight = new THREE.DirectionalLight("#ffffff", 0.1);
	directionalLight.position.x = -5;
	directionalLight.position.y = 5;
  directionalLight.position.z = 5;
  directionalLight.castShadow = true;
	scene.add(directionalLight);

	let light = new THREE.SpotLight(0xefdfd5, 0.75);
	light.position.y = 10;
	light.target.position.set(0, 0, 0);
	light.shadow.camera.near = 5;
	light.shadow.camera.far = 11;
	light.shadow.mapSize.width = 24;
	light.shadow.mapSize.height = 24;
	scene.add(light);
}

function roll(seed, body) {
  const random = AleaRandom(seed);
  var angle = ((random() - 0.5) * Math.PI * 2) * 0.1;

  body.position.set(0, 2, -5);
  body.velocity.set(Math.sin(angle) * 7, -1, Math.cos(angle) * 9);

  body.angularVelocity.set(
    (0.5 + random() * 0.1) * Math.PI,
    (0.5 + random() * 0.1) * Math.PI,
    (0.5 + random() * 0.1) * Math.PI
  );

  body.quaternion.setFromEuler(
    random() * 2 * Math.PI,
    random() * 2 * Math.PI,
    random() * 2 * Math.PI
  );
}

$(function () {
  const WIDTH = 600;
  const HEIGHT = 400;

  const dice = [];
  let diceWithUnknownPositions = []

  const scene = new THREE.Scene();
  add_light(scene);

  const world = new CANNON.World();
  world.allowSleep = true;

  world.gravity.set(0, -9.8, 0);
  add_plane(scene, world);

  const camera = new THREE.PerspectiveCamera(80, WIDTH / HEIGHT, 0.1, 1000);
  camera.position.set(-1, 8, -1);
  camera.lookAt(new THREE.Vector3(-0.5, 0, -0.5));
  const controls = new OrbitControls(camera);

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.shadowMap.enabled = true;
  renderer.domElement.id = 'undead_dice';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
  renderer.setSize(window.innerWidth, window.innerHeight);

  // enable interaction callbacks
  new Interaction(renderer, scene, camera);

  $('body').append(renderer.domElement);

  const addDieToQueue = color => {
    $('#queue').append(
      $('<div>', { class: 'queued' }).append(
        $('<i>', { class: 'fa fa-dice-d6' }).css('color', color)
      )
    );
  };
  
  const addDieToScene = (id, color) => {
    dice[id] = createDie(color);

    scene.add(dice[id].mesh);
    world.add(dice[id].body);

    dice[id].mesh.on('click', event => {
      const shift = event.data.originalEvent.shiftKey;

      if (shift) {
        console.log(event.target);
      } else {
        $.post(location.pathname, { action: 'reroll', id: id })
      }
    });

    return dice[id];
  };

  $('script[data-queue]').data('queue').forEach(addDieToQueue);

  const board = $('script[data-board]').data('board');

  for (const [id, params] of Object.entries(board)) {
    if (params.position && params.quaternion) {
      const die = addDieToScene(id, params.color);

      // put the die where it belongs
      die.body.position.set(...params.position);
      die.body.quaternion.set(...params.quaternion);
      
      // make the die immovable
      die.body.mass = 0;
      die.body.updateMassProperties();
    } else {
      console.log(`Error: die ${id} has no position information!`);
    }
  }

  function render() {
    world.step(1/30);
    
    for (let die of Object.values(dice)) {
      die.mesh.position.copy(die.body.position);
      die.mesh.quaternion.copy(die.body.quaternion);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);

  var windowHeight = window.innerHeight;
  var tanFOV = Math.tan(((Math.PI/180)*camera.fov/2));

  function onWindowResize() {
    camera.fov = (360/Math.PI)*Math.atan(tanFOV*(window.innerHeight/windowHeight));
    camera.updateProjectionMatrix();
    camera.lookAt(scene.position);
    renderer.setSize( window.innerWidth, window.innerHeight );
  }
  
  window.addEventListener('resize', onWindowResize, false);

  MessageBus.subscribe(location.pathname, message => {
    console.log("Received message:", message);

    if (message.action == 'reset') {
      for (const die of Object.values(dice)) {
        world.remove(die.body);
        scene.remove(die.mesh);
      }

      $('#queue').empty();
      dice.splice(0, dice.length);

   } else if (message.action == 'pull') {      
      addDieToQueue(message.color);

    } else if (message.action == 'roll') {
      $('#queue').empty();
      
      message.dice.forEach(params => {
        const id = params.id;
        const color = params.color;
        const die = addDieToScene(id, color);

        // when the die stops moving, never let it move again
        const sleepCallback = event => {
          die.body.mass = 0;
          die.body.updateMassProperties();
          die.body.removeEventListener(sleepCallback);

          // so when we roll a die, we need to send its final position
          // to the server so that it can recreate the scene for new users
          // the user that rolls the die reports its position to the server
          if (diceWithUnknownPositions.includes(id)) {
            $.post(location.pathname, {
              id: id,
              action: 'diePositionReport',
              position: die.mesh.position.toArray(),
              quaternion: die.mesh.quaternion.toArray()
            });

            const index = diceWithUnknownPositions.indexOf(id);
            diceWithUnknownPositions.splice(index, 1);
          }
        };

        die.body.addEventListener("sleep", sleepCallback);
        roll(id, die.body);
      });

    } else if (message.action == 'remove') {
      const die = dice[message.id];
      world.remove(die.body);
      scene.remove(die.mesh);
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
    $.post(location.pathname, { action: 'roll' }, newDiceIds => {
      diceWithUnknownPositions = newDiceIds;
    });
  });
});