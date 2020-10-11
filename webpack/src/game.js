import createDie from './die';

import $ from 'jquery';
import * as THREE from 'three';
import * as CANNON from 'cannon';
import { Interaction } from 'three.interaction';
import OrbitControls from 'orbit-controls-es6';

import AleaRandom from 'seedrandom/lib/alea';
import seedrandom from 'seedrandom';
import MessageBus from 'message-bus-client';
import CannonDebugRenderer from 'cannon/tools/threejs/CannonDebugRenderer';

MessageBus.baseUrl = `${location.pathname}/`;
Math.random = AleaRandom(location.pathname);

function add_plane(scene, world) {
  const loader = new THREE.TextureLoader();

  const wood = new THREE.MeshPhongMaterial({
    map: loader.load('/textures/wood-6.jpg'),
    side: THREE.DoubleSide
  });

  const concrete = new THREE.MeshBasicMaterial({ 
    map: loader.load('/textures/concrete.jpg'),
    side: THREE.DoubleSide 
  });
  
  const geometry = new THREE.PlaneGeometry(30, 30);
	const floor = new THREE.Mesh(geometry, wood);
	floor.receiveShadow = true;
  floor.rotation.x = 3*Math.PI/2;
  floor.position.set(0,-5,0);
  scene.add(floor);

	const rightWall = new THREE.Mesh(geometry, concrete);
  rightWall.receiveShadow = true;
  rightWall.castShadow = true;
  rightWall.rotation.x = Math.PI;
  rightWall.position.set(0,0,15);
  scene.add(rightWall);
  
  const leftWall = new THREE.Mesh(geometry, concrete);
  leftWall.receiveShadow = true;
  leftWall.castShadow = true;
  leftWall.rotation.y = 3*Math.PI/2;
  leftWall.position.set(15,0,0);
  scene.add(leftWall);
  
  // create bodies for our floor and walls
  [floor, leftWall, rightWall].forEach(plane => {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane()
    });
    
    body.position.set(...plane.position.toArray());
    body.quaternion.set(...plane.quaternion.toArray());
    
    world.add(body);
  });
}

function add_light(scene) {
  let ambient = new THREE.AmbientLight("#ffffff", 0.1);
	scene.add(ambient);

	let directionalLight = new THREE.DirectionalLight("#ffffff", 0.5);
	directionalLight.position.x = -1000;
	directionalLight.position.y = 1000;
	directionalLight.position.z = 1000;
	scene.add(directionalLight);

	let light = new THREE.SpotLight(0xefdfd5, 0.75);
	light.position.y = 100;
	light.target.position.set(0, 0, 0);
	light.castShadow = true;
	light.shadow.camera.near = 50;
	light.shadow.camera.far = 110;
	light.shadow.mapSize.width = 1024;
	light.shadow.mapSize.height = 1024;
	scene.add(light);
}

function roll(seed, body) {
  const random = AleaRandom(seed);
  const angle = random() * (Math.PI/3 - Math.PI/6) + Math.PI/6;
  
  body.position.set(-15, 5, -15);
  body.velocity.set(Math.sin(angle) * 20, 5, Math.cos(angle) * 20);

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

  var camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 1000);
  
  // uncomment this to allow panning
  // const controls = new OrbitControls(camera);
  // controls.minPolarAngle = 0;
  // controls.maxPolarAngle = Math.PI; 

  camera.matrix.fromArray([-0.7020940737935837, 0, 0.7120842025659113, 0, 0.5580117805721432, 0.6212256439579669, 0.5501831986090775, 0, -0.4423649672913037, 0.7836317370353305, -0.43615884311149133, 0, -2.518793793941353, 15.16875511436643, -1.0001621109319112, 1]);
  camera.matrix.decompose(camera.position, camera.quaternion, camera.scale)
  scene.add(camera);
  
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.renderReverseSided = true;
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
  var cannonDebugRenderer = new THREE.CannonDebugRenderer( scene, world );

  function render() {
    world.step(1/30);

    for (let die of Object.values(dice)) {
      die.mesh.position.copy(die.body.position);
      die.mesh.quaternion.copy(die.body.quaternion);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);

    // uncomment out this to see wireframes on cannon bodies
    // cannonDebugRenderer.update();
  };

  requestAnimationFrame(render);

  var windowHeight = window.innerHeight;
  var tanFOV = Math.tan(((Math.PI/180)*camera.fov/2));

  function onWindowResize() {
    camera.fov = (360/Math.PI)*Math.atan(tanFOV*(window.innerHeight/windowHeight));
    camera.updateProjectionMatrix();
    // camera.lookAt(scene.position);
    renderer.setSize( window.innerWidth, window.innerHeight );
  }
  
  // window.addEventListener('resize', onWindowResize, false);

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

      for (const i in message.dice) {
        console.log(i)
        setTimeout(() => {
          const id = message.dice[i].id;
          const color = message.dice[i].color;
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
        }, i*250);
      }

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