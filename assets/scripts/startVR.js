export async function startVR(app, cameraEntity, Root, target, Room, textUnavailable, textTutorial3D, Screen3D, options = {}) {
  const assetMap = options.assetMap;
  app.graphicsDevice.maxPixelRatio = 1.5;

  const controllerModels  = new Map();
  const controllerUpdates = new Map();

  if (textUnavailable?.element) {
    textUnavailable.element.text = "VR is not supported on your device";
  }

  console.log('[XR DEBUG] supported =', app.xr.supported,
              'secure =', window.isSecureContext,
              'protocol =', location.protocol,
              'ua =', navigator.userAgent);

  try { if (textTutorial3D) textTutorial3D.enabled = false; } catch (e) {}
  try { if (target) target.enabled = false; } catch (e) {}
  try { if (Screen3D) Screen3D.enabled = false; } catch (e) {}

  if (!app.xr.supported) {
    console.log('WebXR is not supported');
    if (textUnavailable) textUnavailable.enabled = true;
    return;
  }

  const ensureControllerModel = (inputSource) => {
    if (controllerModels.has(inputSource)) return controllerModels.get(inputSource);

    let model;
    if (inputSource.handedness === 'left' && assetMap?.Controller_L?.resource) {
      model = assetMap.Controller_L.resource.instantiateRenderEntity();
    } else if (inputSource.handedness === 'right' && assetMap?.Controller_R?.resource) {
      model = assetMap.Controller_R.resource.instantiateRenderEntity();
    } else {
      model = new pc.Entity('ControllerFallback');
      model.addComponent('render', { type: 'box' });
      model.setLocalScale(0.03, 0.03, 0.12);
    }
    Root.addChild(model);
    controllerModels.set(inputSource, model);
    return model;
  };

  const onInputAdd = (inputSource) => {
    const isLikelyController =
      inputSource.targetRayMode === pc.XRTARGETRAY_TRACKED_POINTER ||
      inputSource.handedness === 'left' ||
      inputSource.handedness === 'right';
    if (!isLikelyController) return;

    if (inputSource._visualCreated) return;
    inputSource._visualCreated = true;

    const model = ensureControllerModel(inputSource);

    const updateFn = () => {
      if (!app.xr.active) return;
      const origin = inputSource.getOrigin();
      const rot = inputSource.getRotation();
      if (origin && rot) {
        model.setPosition(origin);
        model.setRotation(rot);
      }
    };

    app.on('update', updateFn);
    controllerUpdates.set(inputSource, updateFn);

    const onRemove = () => {
      const fn = controllerUpdates.get(inputSource);
      if (fn) { app.off('update', fn); controllerUpdates.delete(inputSource); }
      const m = controllerModels.get(inputSource);
      if (m) { try { m.destroy(); } catch (e) {} controllerModels.delete(inputSource); }
    };
    inputSource.on?.('remove', onRemove);
  };

  app.xr.input.on('add', onInputAdd);

  app.xr.on('start', () => {
    console.log('Immersive VR session has started');
    try { if (Room) Room.enabled = true; } catch (e) {}
    try { if (target) target.enabled = false; } catch (e) {}
    try { if (textTutorial3D) textTutorial3D.enabled = false; } catch (e) {}
    try { if (Screen3D) Screen3D.enabled = false; } catch (e) {}
    try { if (Room) Room.enabled = true; } catch (e) {}
  });

  app.xr.on('end', () => {
    console.log('Immersive VR session has ended');

    for (const [, fn] of controllerUpdates) app.off('update', fn);
    controllerUpdates.clear();

    for (const [, m] of controllerModels) { try { m.destroy(); } catch (e) {} }
    controllerModels.clear();
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
