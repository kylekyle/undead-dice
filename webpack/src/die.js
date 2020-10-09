import $ from 'jquery';
import * as THREE from 'three';
import * as CANNON from 'cannon';
import fontfaceonload from 'fontfaceonload';

const DICE = {
  green: [
    'running', 'running',
    'user-injured', 'head-side-virus', 
    'head-side-virus', 'head-side-virus'
  ],

  yellow: [
    'running', 'running',
    'user-injured', 'user-injured', 
    'head-side-virus', 'head-side-virus'
  ],

  red: [
    'running', 'running',
    'user-injured', 'user-injured', 
    'user-injured', 'head-side-virus'
  ]
}

const iconMetadata = $.getJSON( "/fontawesome/metadata/icons.json");

const dieMaterials = color => DICE[color].map(text => {
  const context = document.createElement('canvas').getContext('2d');
  
  const canvas = context.canvas;
  [canvas.width, canvas.height] = [128, 128];
  
  context.fillStyle = "black";
  context.textAlign = "center";
  
  // FontAwesome doesn't load until we try to make an icon but since
  // it's not loaded yet, the icon will not appear  ¯\_(ツ)_/¯
  context.globalAlpha = 0; 
  context.font = '900 80px "Font Awesome 5 Free"';
  context.fillText("?", canvas.width/2, canvas.height/2);

  const texture = new THREE.CanvasTexture(canvas);

  // this fires when FontAwesome is ready, so we re-draw the icon onto the canvas
  fontfaceonload('Font Awesome 5 Free', { 
    success: () => {
      iconMetadata.done(lookup => {
        // get unicode character for icon
        const unicode = lookup[text].unicode;
        const charCode = String.fromCharCode(`0x${unicode}`);
        
        context.globalAlpha = 1;
        context.fillText(charCode, canvas.width/2, canvas.height/2 + 30);

        // tell the renderer that this texture has changed
        texture.needsUpdate = true;
      });
    }
  });

  return new THREE.MeshStandardMaterial({map: texture, transparent: true});
});

const toShape = geometry => {
  const vertices = geometry.vertices.map(vertex =>
    new CANNON.Vec3(vertex.x, vertex.y, vertex.z)
  );

  const faces = geometry.faces.map(face =>
    [face.a, face.b, face.c]
  );
  
  return new CANNON.ConvexPolyhedron(vertices, faces);
}

export default color => {  
  const geometry = new THREE.BoxGeometry(1,1,1);

  // the colored box
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({color: color})
  );
  
  mesh.castShadow = true;
  
  // the icons
  mesh.add(new THREE.Mesh(geometry, dieMaterials(color)));

  // the edges
  mesh.add(
    new THREE.LineSegments( 
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ 
        linewidth: 1, color: 'darkgray'
      })
    )
  );

  const body = new CANNON.Body({
    mass: 100,
    shape: toShape(geometry),
    material: new CANNON.Material({
      friction: 100,
      restitution: 1
    }),
    angularDamping: 0.5,
    allowSleep: true,
    sleepTimeLimit: 1,
    sleepSpeedLimit: 0.1,
  });

  return { 
    mesh: mesh, 
    body: body 
  };
};