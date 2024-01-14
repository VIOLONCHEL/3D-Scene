// Import modules
import * as THREE from "./build/three.module.js";
import Stats from "./libs/stats.module.js";
import { OrbitControls } from "./controls/OrbitControls.js";
import { GUI } from "./libs/lil-gui.module.min.js";
import TWEEN from "./libs/tween.module.js";
import { createMultiMaterialObject } from "./utils/SceneUtils.js";
import { GLTFLoader } from "./loaders/GLTFLoader.js";

// Global variables
const mainContainer = document.getElementById("webgl-scene");
const fpsContainer = document.getElementById("fps");
let stats = null;
let scene,
  camera,
  renderer = null;
let camControls = null;
let plane = null;

// needed for menu
let ctrl = null;
let gui = new GUI();

// needed for model animations
const evil_snowman = new THREE.Group();
const mixers = []; // needed for animations
const clock = new THREE.Clock();

const house = new THREE.Group();
const car = new THREE.Group();

// sound variables
let listener = null;
let sound = null;
let audioLoader = null;
let controlBoxParams = {
  soundon: false,
};

// needed for raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let intersects;

let isDragging = false;
let selectedObject = null;

// Scene
function createScene() {
  scene = new THREE.Scene();
  let screen = new THREE.CubeTextureLoader();
  screen.setPath("textures/background/");
  const background = screen.load([
    "posx.jpg",
    "negx.jpg",
    "posy.jpg",
    "negy.jpg",
    "posz.jpg",
    "negz.jpg",
  ]);
  background.format = THREE.RGBAFormat;
  scene.background = background;
}

// FPS counter
function createStats() {
  stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  fpsContainer.appendChild(stats.dom);
}

// Camera object
function createPerspectiveCamera() {
  const fov = 45;
  const aspect = mainContainer.clientWidth / mainContainer.clientHeight;
  const near = 0.1;
  const far = 500; // meters
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.x = 5;
  camera.position.y = 5;
  camera.position.z = 25;
  camera.lookAt(scene.position);
}

// Interactive controls
function createControls() {
  camControls = new OrbitControls(camera, mainContainer);
  camControls.autoRotate = false;
}

// Light objects
function createLights() {
  const spotLight = new THREE.SpotLight(0xffffff);
  spotLight.position.set(-20, 25, 10);
  spotLight.shadow.mapSize.width = 2048; // default 512
  spotLight.shadow.mapSize.height = 2048; //default 512
  spotLight.intensity = 5;
  spotLight.distance = 200;
  spotLight.angle = Math.PI / 3;
  spotLight.penumbra = 0.4; // 0 - 1
  spotLight.decay = 0.2;
  spotLight.castShadow = true;
  scene.add(spotLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // 0x111111 - 0xaaaaaa, 1 ; 0xffffff, 0.1 - 0.3;
  scene.add(ambientLight);
}

function createPlane() {
  const texture = new THREE.TextureLoader().load("textures/snow.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);

  // const planeGeometry = new THREE.PlaneGeometry(50,50);
  // create hills
  let planeGeometry = new THREE.PlaneGeometry(50, 50, 15, 15);
  let pointPos = planeGeometry.getAttribute("position").array;
  for (let i = 1, l = pointPos.length / 3; i < l; i++) {
    pointPos[i * 3 - 1] = Math.random();
  }
  pointPos.needsUpdate = true;

  const planeMaterial = new THREE.MeshStandardMaterial({ map: texture });
  plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -0.5 * Math.PI;
  plane.position.x = 0;
  plane.position.y = 0;
  plane.position.z = 0;
  plane.receiveShadow = true;
  scene.add(plane);
}

// Creating trees
class TreeGenerator {
  numOfTrees = 0;

  constructor() {}

  showObjectsInfo() {
    // this.numOfTrees = scene.children.length;
    console.log(scene.children);
  }

  createTree(posx, posz, scale) {
    let tree = new THREE.Group();
    const loader = new GLTFLoader();

    // Variables for loading 3D model
    const onLoad = (gltf, grp, position, scale) => {
      const model = gltf.scene.children[0];
      //
      model.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
        }
      });
      model.position.copy(position);
      model.scale.set(scale, scale, scale);
      grp.add(model);
    };
    const onProgress = () => {};
    const onError = (errorMessage) => {
      console.log(errorMessage);
    };

    const modelPosition = new THREE.Vector3(posx, -1, posz);
    const modelScale = scale;
    loader.load(
      "./models/tree/scene.gltf",
      (gltf) => onLoad(gltf, tree, modelPosition, modelScale),
      onProgress,
      onError
    );
    this.numOfTrees++;
    tree.name = "tree-" + this.numOfTrees;
    scene.add(tree);
  }

  addTree() {
    let treePosX = -20 + Math.round(Math.random() * 40);
    let treePosZ = -17.5 + Math.round(Math.random() * 35);
    //let treeSize = Math.ceil((Math.random() * 10));
    let fixedtreeSize = 0.6;
    this.createTree(treePosX, treePosZ, fixedtreeSize);
  }

  removeLastTree() {
    if (this.numOfTrees > 0) {
      let lastTree = scene.getObjectByName("tree-" + this.numOfTrees);
      scene.remove(lastTree);
      this.numOfTrees--;
    }
  }
}

function createEvil_snowman() {
  const loader = new GLTFLoader();
  const onLoad = (gltf, grp, position, scale) => {
    const model = gltf.scene.children[0];
    model.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });
    model.position.copy(position);
    model.scale.set(scale, scale, scale);
    // Model animations
    const animation = gltf.animations[0];
    const mixer = new THREE.AnimationMixer(model);
    mixers.push(mixer);
    const action = mixer.clipAction(animation);
    action.setDuration(10);
    action.play();
    //
    grp.add(model);
    grp.name = "Evil_snowman";
  };
  const onProgress = () => {};
  const onError = (errorMessage) => {
    console.log(errorMessage);
  };

  const modelPosition = new THREE.Vector3(10, 0.1, -5);
  const modelScale = 3;
  loader.load(
    "./models/evil_snowman/scene.gltf",
    (gltf) => onLoad(gltf, evil_snowman, modelPosition, modelScale),
    onProgress,
    onError
  );
  scene.add(evil_snowman);
}

function createHouse() {
  const loader = new GLTFLoader();
  const onLoad = (gltf, grp, position, scale) => {
    const model = gltf.scene.children[0];
    model.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });
    model.position.copy(position);
    model.scale.set(scale, scale, scale);

    grp.add(model);
    grp.name = "House";
  };
  const onProgress = () => {};
  const onError = (errorMessage) => {
    console.log(errorMessage);
  };

  const modelPosition = new THREE.Vector3(-8, 0, -9);
  const modelScale = 2;
  loader.load(
    "./models/house/scene.gltf",
    (gltf) => onLoad(gltf, house, modelPosition, modelScale),
    onProgress,
    onError
  );
  scene.add(house);
}

function createCar() {
  const loader = new GLTFLoader();

  const onLoad = (gltf, grp, position, scale) => {
    const model = gltf.scene.children[0];
    model.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });

    model.position.copy(position);
    model.scale.set(scale, scale, scale);

    grp.add(model);
    grp.name = "Car";
  };

  const onProgress = () => {};
  const onError = (errorMessage) => {
    console.log(errorMessage);
  };


  const newModelPosition = new THREE.Vector3(-5, -0.1, 6);
  const newModelScale = 0.6;


  loader.load(
    "./models/car/scene.gltf",
    (gltf) => onLoad(gltf, car, newModelPosition, newModelScale),
    onProgress,
    onError
  );

  scene.add(car);
}

function giftbox() {
  const glftboxLoader = new GLTFLoader();
  glftboxLoader.load("./models/giftbox/scene.gltf", (gltfScene) => {
    gltfScene.scene.position.set(13, -0.1, 10);
    gltfScene.scene.scale.set(0.015, 0.015, 0.015);

    gltfScene.scene.rotation.set(0, 0, Math.PI * 2);
    gltfScene.scene.traverse(function (node) {
      if (node.isMesh) node.castShadow = true;
    });
    gltfScene.scene.name = "giftbox";
    scene.add(gltfScene.scene);
  });
}

let isGiftboxVisible = true; // Initial state

function toggleGiftboxVisibility() {
  const giftbox = scene.getObjectByName("giftbox");
  if (giftbox) {
    isGiftboxVisible = !isGiftboxVisible;
    giftbox.visible = isGiftboxVisible;
  }
}

function createFlake(posX, posZ) {
  const texture = new THREE.TextureLoader().load("textures/flake.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  let planeGeometry = new THREE.PlaneGeometry(1, 1);
  const planeMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  let flake = new THREE.Mesh(planeGeometry, planeMaterial);
  flake.position.set(posX, 5.0, posZ);
  flake.receiveShadow = true;
  flake.name = "flake";
  scene.add(flake);
}

function createSound() {
  listener = new THREE.AudioListener();
  camera.add(listener);

  // create a global audio source
  sound = new THREE.Audio(listener);
  // load a sound and set it as the Audio object's buffer
  audioLoader = new THREE.AudioLoader();
  audioLoader.load("sounds/Intro.wav", function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.3);
    //sound.play();
  });

  // sound control
  let sb = gui.add(controlBoxParams, "soundon").name("Sound On/Off");
  sb.listen();
  sb.onChange(function (value) {
    if (value == true) sound.play();
    else sound.stop();
  });
}
// Create the ball
function createBall() {
  const geometry = new THREE.SphereGeometry(1, 32, 32);

  // Load texture using TextureLoader
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load("textures/snow.jpg");

  const material = new THREE.MeshStandardMaterial({ map: texture });
  const ball = new THREE.Mesh(geometry, material);
  ball.position.set(0, 1, 0); // Set initial position
  ball.castShadow = true;
  ball.name = "ball"; // Give it a name for identification
  scene.add(ball);
}

// Renderer object and features
function createRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(mainContainer.clientWidth, mainContainer.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; //THREE.BasicShadowMap | THREE.PCFShadowMap | THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mainContainer.appendChild(renderer.domElement);
}

// Animations
function update() {
  // evil_snowman animation
  const delta = clock.getDelta();
  for (const mixer of mixers) {
    mixer.update(delta);
  }

  TWEEN.update();
}

function init() {
  THREE.ColorManagement.enabled = true;
  createScene();
  createStats();
  createPerspectiveCamera();
  createControls();
  createLights();

  // Create meshes and other visible objects:
  createPlane(plane);

  ctrl = new TreeGenerator();
  //ctrl.createTree(0, 0, 10.0);
  gui.add(ctrl, "numOfTrees").name("Number of trees").listen();
  gui.add(ctrl, "addTree").name("Add tree");
  gui.add(ctrl, "removeLastTree").name("Remove tree");
  gui.add(ctrl, "showObjectsInfo").name("Show info");

  createEvil_snowman();
  createHouse();
  createCar();

  // Add fog
  const fogcolor = 0xffffff; // white
  const fognear = 5;
  const fogfar = 100;
  const fogdensity = 0.3;
  scene.fog = new THREE.Fog(fogcolor, fognear, fogfar); // adds linear fog
  //

  giftbox();
  const giftboxFolder = gui.addFolder("Giftbox");
  giftboxFolder
    .add({ toggleGiftbox: toggleGiftboxVisibility }, "toggleGiftbox")
    .name("Show Giftbox ");

  let flakePosX = 0,
    flakePosZ = 0;
  for (let i = 0; i < 20; i++) {
    flakePosX = -20 + Math.round(Math.random() * 40);
    flakePosZ = -17.5 + Math.round(Math.random() * 35);
    const flakeSize = 0.01 + Math.random() * 0.04; // Размер в диапазоне от 0.1 до 0.5
    createFlake(flakePosX, flakePosZ, flakeSize);
  }
  let fall = { y: 10 };
  let tween2 = new TWEEN.Tween(fall).to({ y: -10 }, 10000);
  tween2.easing(TWEEN.Easing.Linear.None);
  let t = 0;
  tween2.onUpdate(() => {
    scene.traverse(function (e) {
      if (e.name == "flake") {
        t++;
        e.position.y = fall.y + t * 0.5;
        e.rotation.x += 0.001 * t;
        e.rotation.y += 0.001 * t;
        e.rotation.z += 0.001 * t;
      } else {
        t = 0;
      }
    });
  });
  tween2.repeat(Infinity);
  tween2.start();

  createSound();
  createBall();

  createRenderer();
  renderer.setAnimationLoop(() => {
    update();
    stats.begin();
    renderer.render(scene, camera);
    stats.end();
  });
}

init();

// Event listener for mousemove
mainContainer.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (isDragging) {
    raycaster.setFromCamera(mouse, camera);
    intersects = raycaster.intersectObject(plane);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      // Update only the ball's position
      selectedObject.position.copy(intersection.point);
    }
  }
});

// Event listener for mousedown
mainContainer.addEventListener("mousedown", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  intersects = raycaster.intersectObjects(scene.children);

  if (intersects.length > 0 && intersects[0].object.name === "ball") {
    isDragging = true;
    selectedObject = intersects[0].object;
    // Disable camera controls while dragging
    camControls.enabled = false;
  }
});

// Event listener for mouseup
mainContainer.addEventListener("mouseup", () => {
  isDragging = false;
  selectedObject = null;
  // Re-enable camera controls after dragging
  camControls.enabled = true;
});

window.addEventListener("resize", (e) => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
