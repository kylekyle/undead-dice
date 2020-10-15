import $ from 'jquery';
import * as THREE from 'three';
import fontfaceonload from 'fontfaceonload';

const DICE = {
  white: [0,1,2,3,4,5], 

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

const geometry = new THREE.BoxGeometry(1,1,1);
const iconMetadata = $.getJSON( "/fontawesome/metadata/icons.json");

const dieMaterial = (color, shift) => {
  const faces = [...DICE[color]];

  if (shift) {
    for(let i=0; i<shift; i++) {
      faces.unshift(faces.pop());
    }
  }
  
  return faces.map(text => {
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
          if (lookup[text]) {
            const unicode = lookup[text].unicode;
            const character = String.fromCharCode(`0x${unicode}`);
            
            context.globalAlpha = 1;
            context.fillText(character, canvas.width/2, canvas.height/2 + 30);
          } else {
            context.globalAlpha = 1;
            context.fillText(text, canvas.width/2, canvas.height/2 + 30);          
          }

          // tell the renderer that this texture has changed
          texture.needsUpdate = true;
        });
      }
    });

    return new THREE.MeshStandardMaterial({map: texture, transparent: true});
  });
};

export default (color, shift) => {  
  const specs = { 
    move: true,
    // put the die below the board until it is rolled, 
    // otherwise we see it flicker atop the board
    pos: [0,-1,0], 
    size: [1,1,1],
    // the colored box
    mesh: new THREE.Mesh( 
      geometry,
      new THREE.MeshStandardMaterial({color: color})
    )
  };

  specs.mesh.castShadow = true;
  
  // the icons
  specs.mesh.add(new THREE.Mesh(geometry, dieMaterial(color, shift)));

  // the edges
  // mesh.add(
  //   new THREE.LineSegments( 
  //     new THREE.EdgesGeometry(mesh.geometry),
  //     new THREE.LineBasicMaterial({ 
  //       linewidth: 1, color: 'darkgray'
  //     })
  //   )
  // );
  
  return specs;
};