import createDie from './die';

import $ from 'jquery';
import * as THREE from 'three';
import * as CANNON from 'cannon';
import { Interaction } from 'three.interaction';

import OrbitControls from 'orbit-controls-es6';
// import AleaRandom from 'seedrandom/lib/alea';
import MessageBus from 'message-bus-client';

const random = Math.random;

let randToFace = (rand, sides) => {
  return Math.floor(random * (max - min + 1)) + min;
}

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

function roll(diceBody) {
  var angle = ((random() - 0.5) * Math.PI * 2) * 0.1;

  diceBody.position.set(0, 2, -5);
  diceBody.velocity.set(Math.sin(angle) * 7, -1, Math.cos(angle) * 9);

  diceBody.angularVelocity.set(
    (0.5 + random() * 0.1) * Math.PI,
    (0.5 + random() * 0.1) * Math.PI,
    (0.5 + random() * 0.1) * Math.PI
  );

  diceBody.quaternion.setFromEuler(
    random() * 2 * Math.PI,
    random() * 2 * Math.PI,
    random() * 2 * Math.PI
  );
}

$(function () {
  const WIDTH = 600;
  const HEIGHT = 400;

// console.log(script[data-id="MyUniqueName"][data-token]

  const dice = [];
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

  function render() {
    world.step(1/30);

    dice.forEach(die => {
      die.position.copy(die.userData.body.position);
      die.quaternion.copy(die.userData.body.quaternion);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
  }
  
  window.addEventListener('resize', onWindowResize, false);

  MessageBus.subscribe(location.pathname, message => {
    console.log("Received message:", message);

    if (message.action == 'pull') {      
      $('#queue').append(
        $('<div>', { class: 'queued' }).append(
          $('<i>', { class: 'fa fa-dice-d6' }).css({
            color: message.die.color
          })
        )
      );
    } else if (message.action == 'roll') {
      $('#queue').empty();
      
      message.dice.forEach(result => {
        const die = createDie(result.id, result.color);

        scene.add(die);
        world.add(die.userData.body);
        dice.push(die);

        roll(die.userData.body);

        die.on('click', () => 
          $.post(location.pathname, { action: 'reroll', id: result.id })
        );
      });
    }
  });

  $('#pull').click(() => {
    $.post(location.pathname, { action: 'pull' });
  });

  $('#roll').click(() => {
    
    $.post(location.pathname, { action: 'roll' });
  });

  // $('#undead_dice').click(function () {
  //   objects.forEach(object => roll(object.body));
  // });

  setInterval(Math.random())
});