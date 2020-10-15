import $ from 'jquery';
import * as OIMO from 'oimo';
import * as THREE from 'three';
import { Interaction } from 'three.interaction';
// import OrbitControls from 'orbit-controls-es6';

const WIDTH = 16;
const DEPTH = 16;
const HEIGHT = 9;

// controls the visuals of our board
const scene = new THREE.Scene();

// controls the physics of our board
const world = new OIMO.World({ random: false });

export default class {
    constructor() {
        // camera
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        // const controls = new OrbitControls(camera);

        camera.position.set(0,12,0);
        camera.rotation.x = 3*Math.PI/2;
        // controls.update();

        // renderer
        const renderer = new THREE.WebGLRenderer();
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setSize( window.innerWidth, window.innerHeight );
        $('body').append(renderer.domElement);

        // enable interaction callbacks so we can click on dice
        new Interaction(renderer, scene, camera);

        const onWindowResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize( window.innerWidth, window.innerHeight );
        }

        window.addEventListener('resize', onWindowResize, false );
        
        // lighting
        const ambientLight = new THREE.AmbientLight("#ffffff", 0.2);
        scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xefdfd5);
        spotLight.position.set(5, 16, 0);
        spotLight.castShadow = true;  
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;

        scene.add(spotLight);

        // board
        this.add({size: [WIDTH, 1, HEIGHT] }); 
        this.add({size: [WIDTH, 1, HEIGHT], pos: [0, DEPTH, 0]}); 
        this.add({size: [WIDTH, DEPTH, 1], pos: [0, DEPTH/2, HEIGHT/2]}); 
        this.add({size: [WIDTH, DEPTH, 1], pos: [0, DEPTH/2, -HEIGHT/2]});
        this.add({size: [HEIGHT+1, DEPTH, 1], pos: [WIDTH/2, DEPTH/2, 0], rot: [0, 90, 0]});
        this.add({size: [HEIGHT+1, DEPTH, 1], pos: [-WIDTH/2, DEPTH/2, 0], rot: [0, 90, 0]});

        // animate
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        // start the game
        animate();
        world.play();
    }

    add(specs) {
        const body = world.add(specs);
        body.mesh = specs.mesh;

        // if mesh is null, then this body won't be rendered at all
        if (body.mesh !== null) {

            // if mesh is undefined, then it's part of the board
            if (body.mesh === undefined) {
                specs.friction = 0.5;

                body.mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(...specs.size), 
                    new THREE.MeshStandardMaterial({ color: 'gray' }) 
                )
            }

            // assign default properties for all meshes
            body.mesh.receiveShadow = true;
            body.mesh.position.copy(body.getPosition());
            body.mesh.quaternion.copy(body.getQuaternion());
            
            scene.add(body.mesh);
        }

        return body;
    }

    remove(body) {
        if (body.mesh) {
            scene.remove(body.mesh);
        }

        body.remove();
    }

    fastForward(frames) {
        for(let i=0; i<frames; i++) {
            world.step();
        }
    }
};