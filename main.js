import { createSplash, setSplashProgress, hideSplash, loadAssets } from './assets/scripts/loader.js';
import { createUI } from './assets/scripts/uiPanel.js';
import { startAR } from './assets/scripts/startAR.js';
import { startVR } from './assets/scripts/startVR.js';
import { createXrMovement } from './assets/scripts/xrMovement.js';

const canvas = document.getElementById('application-canvas');
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: `assets/lib/ammo.wasm.js`,
    wasmUrl: `assets/lib/ammo.wasm.wasm`,
    fallbackUrl: `assets/lib/ammo.js`   
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
        alpha: true,
        devicePixelRatio: false,
        antialias: false
    }
});

const createOptions = new pc.AppOptions();
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem
];

app.mouse = new pc.Mouse(canvas);
app.touch = new pc.TouchDevice(canvas);
app.elementInput = new pc.ElementInput(canvas, {
    useMouse: true,
    useTouch: true
});

const ua = navigator.userAgent;
if (/Quest/.test(ua) && /OculusBrowser/.test(ua)) {
    app.graphicsDevice.maxPixelRatio = 0.6;
} else {
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 1.5);
};

app.loader.addHandler("font", new pc.FontHandler(app.graphicsDevice));
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

const fontTexture = new pc.Asset("HelveticaTex", "texture", {
    url: "assets/fonts/Helvetica.png"});
app.assets.add(fontTexture);

const assetMap = {
    Bedroom_1: new pc.Asset("Bedroom_1", "gsplat", { url: "assets/gsplats/Bedroom_1.compressed.ply" }),
    Bedroom_2: new pc.Asset("Bedroom_2", "gsplat", { url: "assets/gsplats/Bedroom_2.compressed.ply" }),
    Bedroom_2_Balcony: new pc.Asset("Bedroom_2_Balcony", "gsplat", { url: "assets/gsplats/Bedroom_2_Balcony.compressed.ply" }),
    Corridor: new pc.Asset("Corridor", "gsplat", { url: "assets/gsplats/Corridor.compressed.ply" }),
    Guestroom: new pc.Asset("Guestroom", "gsplat", { url: "assets/gsplats/Guestroom.compressed.ply" }),
    Kitchen: new pc.Asset("Kitchen", "gsplat", { url: "assets/gsplats/Kitchen.compressed.ply" }),
    Kitchen_Balcony: new pc.Asset("Kitchen_Balcony", "gsplat", { url: "assets/gsplats/Kitchen_Balcony.compressed.ply" }),
    Toilet: new pc.Asset("Toilet", "gsplat", { url: "assets/gsplats/Toilet.compressed.ply" }),
    Controller_L: new pc.Asset("Controller_L", "container", {url: "assets/models/controller_l.glb" }),
    Controller_R: new pc.Asset("Controller_R", "container", {url: "assets/models/controller_r.glb" }),
    FontTexture: fontTexture,
    Font: new pc.Asset("Helvetica", "font", {url: "assets/fonts/Helvetica.json"}, null, null, [fontTexture]),
};

const scriptAssets = [
    new pc.Asset("triggerObjectActivator.js", "script", { url: "assets/scripts/triggerObjectActivator.js" })
];

scriptAssets.forEach(asset => app.assets.add(asset));
Object.values(assetMap).forEach(asset => app.assets.add(asset));

const assetList = [
    { asset: assetMap.Bedroom_1, size: 11.3 * 1024 * 1024 },
    { asset: assetMap.Bedroom_2, size: 7.8 * 1024 * 1024 },
    { asset: assetMap.Bedroom_2_Balcony, size: 4.7 * 1024 * 1024 },
    { asset: assetMap.Corridor, size: 1.5 * 1024 * 1024 },
    { asset: assetMap.Guestroom, size: 12.9 * 1024 * 1024 },
    { asset: assetMap.Kitchen, size: 7.1 * 1024 * 1024 },
    { asset: assetMap.Kitchen_Balcony, size: 2.7 * 1024 * 1024 },
    { asset: assetMap.Toilet, size: 3.4 * 1024 * 1024 },
    { asset: assetMap.Controller_L, size: 261 * 1024 },
    { asset: assetMap.Controller_R, size: 261 * 1024 },
    { asset: assetMap.FontTexture, size: 94 * 1024 },
    { asset: scriptAssets[0], size: 4 * 1024 }
];

initApp();

async function initApp() {
    createSplash();

    await loadAssets(app, assetList, null, setSplashProgress);

    hideSplash();
    document.getElementById("start-screen").style.display = "flex";
    
    //------------------------------------------------------------ AR ---------------------------------------------------------
    document.getElementById("start-AR")?.addEventListener("click", async () => {        
        document.getElementById("start-screen")?.remove();
        document.getElementById("logo")?.remove();

        startApp(async (params) => {
            const xrMove = createXrMovement(app, params.Camera, params.Root, {
                movementSpeed: 1.6,
                snapAngleDeg: 45,
                smoothRotate: false
            });
            xrMove.disable();
            await startAR(app, params.Camera, params.Root, params.target, params.Room, params.textUnavailable, params.textTutorial2D, params.Screen2D, params.Screen3D, params.textTutorial3D, { onPlacementDone: () => xrMove.enable() });
        });
    });

    //------------------------------------------------------------ VR ---------------------------------------------------------
    document.getElementById("start-VR")?.addEventListener("click", async () => {        
        document.getElementById("start-screen")?.remove();
        document.getElementById("logo")?.remove();

        startApp(async (params) => {
            const xrMove = createXrMovement(app, params.Camera, params.Root, {
                movementSpeed: 1.6,
                snapAngleDeg: 45,
                smoothRotate: false
            });
            xrMove.disable();
            await startVR(app, params.Camera, params.Root, params.target, params.Room, params.textUnavailable, params.textTutorial3D, params.Screen3D, { onPlacementDone: () => xrMove.enable(), assetMap});
        });
    });
};

function startApp(onSceneReady) {

    createScene(onSceneReady);

    function createScene(onSceneReady) {

        const layer1 = new pc.Layer({name: '1'});
        const layer2 = new pc.Layer({name: '2'});
        const layer3 = new pc.Layer({name: '3'});
        const layer4 = new pc.Layer({name: '4'});
        const layer5 = new pc.Layer({name: '5'});
        const layer6 = new pc.Layer({name: '6'});
        const layer7 = new pc.Layer({name: '7'});
        const layer8 = new pc.Layer({name: '8'});

        const worldLayer = app.scene.layers.getLayerByName('World');
        const uiLayer = app.scene.layers.getLayerByName('UI');
        const idx = app.scene.layers.getTransparentIndex(worldLayer);

        app.scene.layers.insert(layer1, idx + 1);
        app.scene.layers.insert(layer2, idx + 2);
        app.scene.layers.insert(layer3, idx + 3);
        app.scene.layers.insert(layer4, idx + 4);
        app.scene.layers.insert(layer5, idx + 5);
        app.scene.layers.insert(layer6, idx + 6);
        app.scene.layers.insert(layer7, idx + 7);
        app.scene.layers.insert(layer8, idx + 8);

        app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.4);

        const Root = new pc.Entity("Root");
        Root.enabled = true;
        app.root.addChild(Root);

        const Camera = new pc.Entity("Camera");
        Camera.addComponent('camera', {
            clearColor: new pc.Color(0, 0, 0, 0),
            farClip: 1000,
            fov: 45,
            frustumCulling: true,
            layers: [uiLayer.id, worldLayer.id, layer1.id, layer2.id, layer3.id, layer4.id, layer5.id, layer6.id, layer7.id, layer8.id]
        });
        app.root.addChild(Camera);

        const CameraTrigger = new pc.Entity('CameraTrigger');
        Camera.addChild(CameraTrigger);

        app.once("update", () => {
            CameraTrigger.addComponent('collision', { type: 'sphere', radius: 0.2 });
            CameraTrigger.addComponent('rigidbody', { type: 'kinematic', friction: 0, restitution: 1});
        });

        const Light = new pc.Entity();
        Light.setPosition(0, 0, 0);
        Light.setEulerAngles(-130, 0, -220);
        Light.setLocalScale(1, 1, 1);
        Light.addComponent('light', {
            type: 'directional',
            color: new pc.Color(1, 1, 1),
            isStatic: true,
            intensity: 1,
            castShadows: false,
            affectDynamic: true,
            affectSpecular: false,
            layers: [worldLayer.id]
        });
        Root.addChild(Light);

        const target = new pc.Entity();
        target.addComponent('render', {
            type: 'cylinder'
        });
        target.setLocalScale(0.1, 0.01, 0.1);
        app.root.addChild(target);

        const Room = new pc.Entity();
        Room.enabled = false;
        Root.addChild(Room);

        //---------------------------------------- GSPLATS ----------------------------------------------- //

        const Gsplats = new pc.Entity();
        Gsplats.setEulerAngles(0, 0, 180);
        Room.addChild(Gsplats);

        const Bedroom_1 = new pc.Entity();
        Bedroom_1.setPosition(2.749, 0, 2.614);
        Bedroom_1.addComponent("gsplat", { asset: assetMap.Bedroom_1 });
        Gsplats.addChild(Bedroom_1);

        const Bedroom_2 = new pc.Entity();
        Bedroom_2.setPosition(2.914, 0, -2.3);
        Bedroom_2.addComponent("gsplat", { asset: assetMap.Bedroom_2 });
        Gsplats.addChild(Bedroom_2);

        const Bedroom_2_Balcony = new pc.Entity();
        Bedroom_2_Balcony.setPosition(2.818, 0, -5.487);
        Bedroom_2_Balcony.addComponent("gsplat", { asset: assetMap.Bedroom_2_Balcony });
        Gsplats.addChild(Bedroom_2_Balcony);

        const Guestroom = new pc.Entity();
        Guestroom.setPosition(-1.085, 0, 2.138);
        Guestroom.addComponent("gsplat", { asset: assetMap.Guestroom });
        Gsplats.addChild(Guestroom);

        const Kitchen = new pc.Entity();
        Kitchen.setPosition(-0.685, 0, -1.614);
        Kitchen.addComponent("gsplat", { asset: assetMap.Kitchen });
        Gsplats.addChild(Kitchen);

        const Kitchen_Balcony = new pc.Entity();
        Kitchen_Balcony.setPosition(-0.297, 0, -4.01);
        Kitchen_Balcony.addComponent("gsplat", { asset: assetMap.Kitchen_Balcony });
        Gsplats.addChild(Kitchen_Balcony);

        const Toilet = new pc.Entity();
        Toilet.setPosition(5.249, 0, -0.376);
        Toilet.addComponent("gsplat", { asset: assetMap.Toilet });
        Gsplats.addChild(Toilet);

        const Corridor = new pc.Entity();
        Corridor.setPosition(2.639, 0, -0.001);
        Corridor.addComponent("gsplat", { asset: assetMap.Corridor });
        Gsplats.addChild(Corridor);

        //---------------------------------------- TRIGGERS ----------------------------------------------- //

        const Triggers = new pc.Entity();
        Triggers.setEulerAngles(0, 0, 0);
        Room.addChild(Triggers);

        const Bedroom_1_Trigger = new pc.Entity();
        Bedroom_1_Trigger.setPosition(-3.034, 1, 2.723);
        Triggers.addChild(Bedroom_1_Trigger);

        const Bedroom_2_Trigger = new pc.Entity();
        Bedroom_2_Trigger.setPosition(-2.893, 1, -2.857);
        Triggers.addChild(Bedroom_2_Trigger);

        const Guerstroom_Trigger = new pc.Entity();
        Guerstroom_Trigger.setPosition(0.644, 1, 2.056);
        Triggers.addChild(Guerstroom_Trigger);

        const Kitchen_Trigger = new pc.Entity();
        Kitchen_Trigger.setPosition(0.428, 1, -2.206);
        Triggers.addChild(Kitchen_Trigger);

        const Kitchen_Balcony_Trigger = new pc.Entity();
        Kitchen_Balcony_Trigger.setPosition(0.476, 1, -4.492);
        Triggers.addChild(Kitchen_Balcony_Trigger);

        const Bedroom_2_Balcony_Trigger = new pc.Entity();
        Bedroom_2_Balcony_Trigger.setPosition(-2.995, 1, -5.742);
        Triggers.addChild(Bedroom_2_Balcony_Trigger);

        const Toilet_Trigger = new pc.Entity();
        Toilet_Trigger.setPosition(-5.747, 1, -0.565);
        Triggers.addChild(Toilet_Trigger);

        const Corridor_1_Trigger = new pc.Entity();
        Corridor_1_Trigger.setPosition(-2.871, 1, -0.166);
        Triggers.addChild(Corridor_1_Trigger);

        const Corridor_2_Trigger = new pc.Entity();
        Corridor_2_Trigger.setPosition(1.216, 1, -0.16);
        Triggers.addChild(Corridor_2_Trigger);

        const opt = (hx, hy, hz) => ({ type: 'box', halfExtents: new pc.Vec3(hx, hy, hz)});

        Bedroom_1_Trigger.addComponent('collision', opt(1.6, 4, 2.2));
        Bedroom_2_Trigger.addComponent('collision', opt(1.45, 4, 2));
        Guerstroom_Trigger.addComponent('collision', opt(1.9, 4, 1.65));
        Kitchen_Trigger.addComponent('collision', opt(1.8, 4, 1.4));
        Kitchen_Balcony_Trigger.addComponent('collision', opt(1.6, 4, 0.9));
        Bedroom_2_Balcony_Trigger.addComponent('collision', opt(1.6, 4, 0.9));
        Toilet_Trigger.addComponent('collision', opt(1.4, 4, 1.1));
        Corridor_1_Trigger.addComponent('collision', opt(1.5, 4, 0.7));
        Corridor_2_Trigger.addComponent('collision', opt(2.6, 4, 0.65));

        Bedroom_1_Trigger.addComponent('script');
        Bedroom_2_Trigger.addComponent('script');
        Guerstroom_Trigger.addComponent('script');
        Kitchen_Trigger.addComponent('script');
        Kitchen_Balcony_Trigger.addComponent('script');
        Bedroom_2_Balcony_Trigger.addComponent('script');
        Toilet_Trigger.addComponent('script');
        Corridor_1_Trigger.addComponent('script');
        Corridor_2_Trigger.addComponent('script');

        Bedroom_1_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Bedroom_1, Bedroom_2, Kitchen, Kitchen_Balcony, Bedroom_2_Balcony] }});
        Bedroom_2_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Bedroom_2, Bedroom_2_Balcony, Bedroom_1, Guestroom] }});
        Guerstroom_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Guestroom, Kitchen, Kitchen_Balcony, Corridor, Toilet] }});
        Kitchen_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Kitchen, Kitchen_Balcony, Guestroom, Corridor, Bedroom_1] }});
        Kitchen_Balcony_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Kitchen_Balcony, Kitchen, Guestroom, Bedroom_1] }});
        Bedroom_2_Balcony_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Bedroom_2_Balcony, Bedroom_2, Bedroom_1] }});
        Toilet_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Toilet, Bedroom_2, Bedroom_1, Kitchen, Guestroom] }});
        Corridor_1_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Bedroom_2, Bedroom_1, Kitchen, Guestroom, Toilet, Bedroom_2_Balcony] }});
        Corridor_2_Trigger.script.create('triggerObjectActivator', { attributes: { targetEntities: [Kitchen, Kitchen_Balcony, Guestroom, Corridor, Bedroom_1, Toilet] }});

        const { Screen2D, textUnavailable, textTutorial2D, Screen3D, textTutorial3D } = createUI(assetMap);
        app.root.addChild(Screen2D);
        Root.addChild(Screen3D);

        hideSplash();
        app.start();

        if (onSceneReady) {
            onSceneReady({ Camera, Root, target, Room, textUnavailable, textTutorial2D, Screen2D, Screen3D, textTutorial3D });
        };
    }
};