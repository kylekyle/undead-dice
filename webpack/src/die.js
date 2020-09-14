import * as THREE from 'three';
import * as CANNON from 'cannon';
import fontfaceonload from 'fontfaceonload';

function gen_polyhedron(geometry) {
  var vertices = [];
  var faces = [];
  var i = 0; 
  var v = null; 
  var f = null;

  
  for (i = 0; i < geometry.vertices.length; i++) {
    v = geometry.vertices[i];
    vertices[i] = new CANNON.Vec3(v.x, v.y, v.z);
  }

  for (i = 0; i < geometry.faces.length; i++) {
    f = geometry.faces[i];
    faces[i] = [f.a, f.b, f.c];
  }

  return new CANNON.ConvexPolyhedron(vertices, faces);
}

export default icons => {
  const context = document.createElement('canvas').getContext('2d');

  const canvas = context.canvas;
  [canvas.width, canvas.height] = [128, 128];
  const texture = new THREE.CanvasTexture(canvas);
  
  context.fillStyle = "black";
  context.textAlign = "center";
  context.font = '900 64px "Font Awesome 5 Free"';

  // FontAwesome doesn't load until we try to make an icon but since
  // it's not loaded yet, the icon will not appear  ¯\_(ツ)_/¯ 
  context.fillText("\uf5dc", canvas.width/2, canvas.height/2 + 20);
  
  // this fires when FontAwesome is ready, so we re-draw the icon onto the canvas
  fontfaceonload('Font Awesome 5 Free', { 
    success: () => { 
      // clear canvas
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // redraw 
      context.fillStyle = "red";
      context.fillText("\uf5dc", canvas.width/2, canvas.height/2 + 25);
      
      texture.needsUpdate = true;
    }
  });

  var geometry = new THREE.BoxGeometry(1, 1, 1);
  var material = new THREE.MeshBasicMaterial( { map: texture } );
  
  let die = new THREE.Mesh(geometry, material);
  die.castShadow = true;

  var edgeGeometry = new THREE.EdgesGeometry( die.geometry );
  
  var edgeMaterial = new THREE.LineBasicMaterial( { 
    linewidth: 1,
    color: 0xff0000
  } );

  var edges = new THREE.LineSegments( edgeGeometry, edgeMaterial );

  die.add(edges);

  // move this to userdata
  die.body = new CANNON.Body({
    mass: 100,
    shape: gen_polyhedron(geometry),
    material: new CANNON.Material({
      friction: 100,
      restitution: 1
    }),
    angularDamping: 0.5
  });

  return die;
};