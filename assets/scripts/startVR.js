export async function startVR( app, cameraEntity, Root, target, Room, textUnavailable, textTutorial3D, Screen3D, options = {}) {

  const assetMap = options.assetMap;
  let placementStage = 0;
  let centerPosition = null;
  let locked = false;
  app.graphicsDevice.maxPixelRatio = 1.5;

  const touchersCleanups = [];
  const addToucherCleanup = (fn) => touchersCleanups.push(fn);
  const runTouchersCleanups = () => { touchersCleanups.splice(0).forEach(fn => { try { fn(); } catch(e){} }); };

  const controllerTouchers = new Map();
  const controllerCubes    = new Map();
  const controllerUpdates  = new Map();

  const WhiteMat = new pc.StandardMaterial(); WhiteMat.diffuse = new pc.Color(1,1,1);
  const GreenMat = new pc.StandardMaterial(); GreenMat.diffuse = new pc.Color(0,1,0);
  target.render.material = WhiteMat;
if (textUnavailable?.element) {
  textUnavailable.element.text = "VR is not supported on your device";
}

console.log('[XR DEBUG] supported =', app.xr.supported,
            'secure =', window.isSecureContext,
            'protocol =', location.protocol,
            'ua =', navigator.userAgent);

  try { Screen3D.enabled = true; } catch(e){}
  if (textTutorial3D) {
    textTutorial3D.enabled = true;
    textTutorial3D.element.text = "Point the ray at the floor\nand press trigger";
  }

  if (!app.xr.supported) {
    console.log('WebXR is not supported');
    if (textUnavailable) textUnavailable.enabled = true;
    return;
  }

  const getPlaneY = () => Root?.getPosition()?.y ?? 0;
  function rayPlaneIntersection(origin, dir, y) {
    const dy = dir.y;
    if (Math.abs(dy) < 1e-5) return null;
    const t = (y - origin.y) / dy;
    if (t <= 0) return null;
    return new pc.Vec3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t);
  }

const ensureControllerFor = (inputSource) => {
    if (controllerCubes.has(inputSource)) return controllerCubes.get(inputSource);

    let controllerEntity;

    if (inputSource.handedness === 'left') {
        controllerEntity = assetMap.Controller_L.resource.instantiateRenderEntity();
    } else if (inputSource.handedness === 'right') {
        controllerEntity = assetMap.Controller_R.resource.instantiateRenderEntity();
    }
    Root.addChild(controllerEntity);
    controllerCubes.set(inputSource, controllerEntity);
    return controllerEntity;
};

  const ensureToucherFor = (inputSource) => {
    if (controllerTouchers.has(inputSource)) return controllerTouchers.get(inputSource);
    const toucher = new pc.Entity('toucher');
    toucher.addComponent('render', { type: 'cylinder', material: WhiteMat });
    toucher.setLocalScale(0.1, 0.01, 0.1);
    Root.addChild(toucher);
    controllerTouchers.set(inputSource, toucher);
    return toucher;
  };

  const bindSelectHandlers = (inputSource, toucher) => {
    const onSelect = () => {
      if (locked) return;
      const hitPos = toucher.getPosition().clone();

      if (placementStage === 0) {
        centerPosition = hitPos.clone();
        Root.setPosition(centerPosition);
        placementStage = 1;
        if (textTutorial3D) {
          textTutorial3D.element.text = "Now choose the room's direction\nand press trigger";
        }
      } else if (placementStage === 1) {
        const dir = hitPos.clone().sub(centerPosition);
        dir.y = 0;
        if (dir.lengthSq() > 1e-6) {
          dir.normalize();
          const angleY = Math.atan2(dir.x, dir.z) * pc.math.RAD_TO_DEG;
          Root.setEulerAngles(0, angleY, 0);
        }
        Room.enabled = true;

        for (const [, t] of controllerTouchers) { try { t.destroy(); } catch(e){} }
        controllerTouchers.clear();
        runTouchersCleanups();
        try { target.enabled = false; } catch(e){}
        try { Screen3D.enabled = false; } catch(e){}
        if (textTutorial3D) textTutorial3D.enabled = false;
        locked = true;

        try { options.onPlacementDone && options.onPlacementDone(); } catch(e){}
        placementStage = 2;
      }
    };
    const onSelectStart = () => { if (!locked) toucher.render.material = GreenMat; };
    const onSelectEnd   = () => { if (!locked) toucher.render.material = WhiteMat; };

    inputSource.on('select', onSelect);
    inputSource.on('selectstart', onSelectStart);
    inputSource.on('selectend', onSelectEnd);

    addToucherCleanup(() => {
      try { inputSource.off('select', onSelect); } catch(e){}
      try { inputSource.off('selectstart', onSelectStart); } catch(e){}
      try { inputSource.off('selectend', onSelectEnd); } catch(e){}
    });
  };

  const onInputAdd = (inputSource) => {
    const isLikelyController =
      inputSource.targetRayMode === pc.XRTARGETRAY_TRACKED_POINTER ||
      inputSource.handedness === 'left' ||
      inputSource.handedness === 'right';
    if (!isLikelyController) return;

    try { target.enabled = false; } catch(e){}
    try { Screen3D.enabled = true; } catch(e){}

    if (inputSource._visualCreated) return;
    inputSource._visualCreated = true;

    const controller = ensureControllerFor(inputSource);
    const toucher = ensureToucherFor(inputSource);

    const updateFn = () => {
      if (!app.xr.active) return;

      const origin = inputSource.getOrigin();
      const rot    = inputSource.getRotation();
      if (origin && rot) {
        controller.setPosition(origin);
        controller.setRotation(rot);  
      }

      if (!locked) {
        const dir = inputSource.getDirection();
        const hit = rayPlaneIntersection(origin, dir, getPlaneY());
        if (hit) toucher.setPosition(hit);
      }
    };
    app.on('update', updateFn);
    controllerUpdates.set(inputSource, updateFn);

    bindSelectHandlers(inputSource, toucher);

    const onRemove = () => {
      const fn = controllerUpdates.get(inputSource);
      if (fn) { app.off('update', fn); controllerUpdates.delete(inputSource); }

      const t = controllerTouchers.get(inputSource);
      if (t) { try { t.destroy(); } catch(e){} controllerTouchers.delete(inputSource); }

      const c = controllerCubes.get(inputSource);
      if (c) { try { c.destroy(); } catch(e){} controllerCubes.delete(inputSource); }
    };
    inputSource.on?.('remove', onRemove);
    addToucherCleanup(() => inputSource.off?.('remove', onRemove));
  };

  app.xr.input.on('add', onInputAdd);

  app.xr.on('start', () => {
    console.log('Immersive VR session has started');
    if (!locked) try { target.enabled = false; } catch(e){}
  });

  app.xr.on('end', () => {
    console.log('Immersive VR session has ended');
    for (const [is, fn] of controllerUpdates) { app.off('update', fn); }
    controllerUpdates.clear();

    for (const [, t] of controllerTouchers) { try { t.destroy(); } catch(e){} }
    controllerTouchers.clear();

    for (const [, c] of controllerCubes) { try { c.destroy(); } catch(e){} }
    controllerCubes.clear();

    runTouchersCleanups();

    locked = false;
    placementStage = 0;
    centerPosition = null;
  });

  app.xr.on(`available:${pc.XRTYPE_VR}`, (available) => {
    if (!available) console.log('Immersive VR is unavailable');
  });

  if (app.xr.isAvailable(pc.XRTYPE_VR)) {
    cameraEntity.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
      callback: (err) => {
        if (err) {
          console.log(`WebXR Immersive VR failed to start: ${err.message}`);
          if (textUnavailable) textUnavailable.enabled = true;
        }
      }
    });
  } else {
    console.log('Immersive VR is unavailable');
    if (textUnavailable) textUnavailable.enabled = true;
  }
}