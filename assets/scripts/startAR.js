export async function startAR(app, cameraEntity, Root, target, Room, textUnavailable, textTutorial2D, Screen2D, Screen3D, textTutorial3D, options = {}) {

    let placementStage = 0;
    let centerPosition = null;
    let locked = false; 
    const cleanups = [];
    const controllerTouchers = new Set();

    const addCleanup = (fn) => cleanups.push(fn);
    const runCleanups = () => { cleanups.splice(0).forEach(fn => { try { fn(); } catch(e) {} }); };

    const destroyAllPlacementHelpers = () => {
        runCleanups();
        controllerTouchers.forEach(t => { try { t.destroy(); } catch(e) {} });
        controllerTouchers.clear();

        try { target.enabled = false; } catch(e) {}
        try { Screen2D.enabled = false; } catch(e) {}
        try { Screen3D.enabled = false; } catch(e) {}
        locked = true;
    };

    const WhiteMat = new pc.StandardMaterial();
    WhiteMat.diffuse = new pc.Color(1, 1, 1);
    const GreenMat = new pc.StandardMaterial();
    GreenMat.diffuse = new pc.Color(0, 1, 0);
    target.render.material = WhiteMat;

    if (app.xr.supported) {
        const activate = function () {
            if (app.xr.isAvailable(pc.XRTYPE_AR)) {
                cameraEntity.camera.startXr(pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR, {
                    callback: function (err) {
                        if (err) console.log(`WebXR Immersive AR failed to start: ${err.message}`);
                    }
                });
            } else {
                const children = app.root.children.slice();
                for (const child of children) {
                    if (!child.screen) child.destroy();
                }
                const fallbackCamera = new pc.Entity();
                fallbackCamera.addComponent('camera', {
                    clearColor: new pc.Color(0.05, 0.05, 0.05),
                    farClip: 1000
                });
                fallbackCamera.translate(0, 2, 4);
                fallbackCamera.lookAt(0, 0, 0);
                app.root.addChild(fallbackCamera);
                textUnavailable.enabled = true;
                return;
            }
        };

        activate();

        app.xr.hitTest.on('available', () => {
            if (locked) return;
            textTutorial2D.enabled = true;

            app.xr.hitTest.start({
                entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE],
                callback: function (err, hitTestSource) {
                    if (err) {
                        console.log('Failed to start AR hit test');
                        return;
                    }

                    const onResult2D = (position, rotation) => {
                        if (locked) return;
                        target.setPosition(position);
                        target.setRotation(rotation);
                    };
                    hitTestSource.on('result', onResult2D);
                    addCleanup(() => hitTestSource.off('result', onResult2D));

                    const onSelect2D = (inputSource) => {
                        if (locked) return;
                        if (inputSource.targetRayMode !== pc.XRTARGETRAY_SCREEN) return;

                        const hitPos = target.getPosition().clone();

                        if (placementStage === 0) {
                            centerPosition = hitPos.clone();
                            Root.setPosition(centerPosition);
                            placementStage = 1;
                            textTutorial2D.element.text = "Now choose the room's direction\nand tap the screen";
                        } else if (placementStage === 1) {
                            const dir = hitPos.clone().sub(centerPosition);
                            dir.y = 0;
                            dir.normalize();
                            const angleY = Math.atan2(dir.x, dir.z) * pc.math.RAD_TO_DEG;
                            Root.setEulerAngles(0, angleY, 0);
                            Room.enabled = true;

                            destroyAllPlacementHelpers();
                            placementStage = 2;
                        }
                    };
                    const onSelectStart2D = (inputSource) => {
                        if (locked) return;
                        if (inputSource.targetRayMode !== pc.XRTARGETRAY_SCREEN) return;
                        target.render.material = GreenMat;
                    };
                    const onSelectEnd2D = (inputSource) => {
                        if (locked) return;
                        if (inputSource.targetRayMode !== pc.XRTARGETRAY_SCREEN) return;
                        target.render.material = WhiteMat;
                    };

                    app.xr.input.on('select', onSelect2D);
                    app.xr.input.on('selectstart', onSelectStart2D);
                    app.xr.input.on('selectend', onSelectEnd2D);

                    addCleanup(() => app.xr.input.off('select', onSelect2D));
                    addCleanup(() => app.xr.input.off('selectstart', onSelectStart2D));
                    addCleanup(() => app.xr.input.off('selectend', onSelectEnd2D));
                }
            });
        });

        app.xr.on('start', () => console.log('Immersive AR session has started'));
        app.xr.on('end', () => console.log('Immersive AR session has ended'));
        app.xr.on(`available:${pc.XRTYPE_AR}`, (available) => {
            if (available) {
                if (app.xr.hitTest.supported) {
                    console.log('Touch screen to start AR session and look at the floor or walls');
                } else {
                    console.log('AR Hit Test is not supported');
                }
            } else {
                console.log('Immersive AR is unavailable');
            }
        });

        if (app.xr.hitTest.supported) {
            app.xr.input.on('add', (inputSource) => {
                if (locked) return;

                const isLikelyController =
                    inputSource.targetRayMode === pc.XRTARGETRAY_POINTER ||
                    inputSource.handedness === 'left' ||
                    inputSource.handedness === 'right';

                const isTouch = inputSource.targetRayMode === pc.XRTARGETRAY_SCREEN;

                console.log('[Input added]', inputSource.targetRayMode, inputSource.handedness, inputSource.profiles);

                if (isLikelyController) {
                    if (inputSource._toucherCreated) return;
                    inputSource._toucherCreated = true;

                    target.enabled = false;
                    Screen2D.enabled = false;
                    Screen3D.enabled = true;

                    if (inputSource._htsStarted) return;
                    inputSource._htsStarted = true;

                    inputSource.hitTestStart({
                        entityTypes: [pc.XRTRACKABLE_POINT, pc.XRTRACKABLE_PLANE],
                        callback: (err, hitTestSource) => {
                            if (err || locked) return;

                            const toucher = new pc.Entity('toucher');
                            toucher.addComponent('render', { type: 'cylinder', material: WhiteMat });
                            toucher.setLocalScale(0.1, 0.01, 0.1);
                            Root.addChild(toucher);
                            controllerTouchers.add(toucher);

                            const onResult3D = (position, rotation) => {
                                if (locked || !toucher.enabled) return;
                                toucher.setPosition(position);
                                toucher.setRotation(rotation);
                            };
                            hitTestSource.on('result', onResult3D);

                            const onSelect3D = () => {
                                if (locked) return;
                                const hitPos = toucher.getPosition().clone();

                                if (placementStage === 0) {
                                    centerPosition = hitPos.clone();
                                    Root.setPosition(centerPosition);
                                    placementStage = 1;
                                    textTutorial3D.element.text = "Now choose the room's direction\nand tap the screen";
                                } else if (placementStage === 1) {
                                    const dir = hitPos.clone().sub(centerPosition);
                                    dir.y = 0;
                                    dir.normalize();
                                    const angleY = Math.atan2(dir.x, dir.z) * pc.math.RAD_TO_DEG;
                                    Root.setEulerAngles(0, angleY, 0);
                                    Room.enabled = true;

                                    destroyAllPlacementHelpers();
                                    placementStage = 2;
                                    try { options.onPlacementDone && options.onPlacementDone(); } catch (e) {}
                                }
                            };
                            const onSelectStart3D = () => { if (!locked) toucher.render.material = GreenMat; };
                            const onSelectEnd3D = () => { if (!locked) toucher.render.material = WhiteMat; };

                            inputSource.on('select', onSelect3D);
                            inputSource.on('selectstart', onSelectStart3D);
                            inputSource.on('selectend', onSelectEnd3D);

                            addCleanup(() => {
                                try { hitTestSource.off('result', onResult3D); } catch(e) {}
                                try { inputSource.off('select', onSelect3D); } catch(e) {}
                                try { inputSource.off('selectstart', onSelectStart3D); } catch(e) {}
                                try { inputSource.off('selectend', onSelectEnd3D); } catch(e) {}
                            });
                        }
                    });
                }

                if (isTouch) {
                    console.log('Touch input registered');
                }
            });
        }

        if (!app.xr.isAvailable(pc.XRTYPE_AR)) {
            const children = app.root.children.slice();
            for (const child of children) {
                if (!child.screen) child.destroy();
            }

            const fallbackCamera = new pc.Entity();
            fallbackCamera.addComponent('camera', {
                clearColor: new pc.Color(0.05, 0.05, 0.05),
                farClip: 1000
            });
            fallbackCamera.translate(0, 2, 4);
            fallbackCamera.lookAt(0, 0, 0);
            app.root.addChild(fallbackCamera);

            textUnavailable.enabled = true;
            return;
        } else if (!app.xr.hitTest.supported) {
            console.log('AR Hit Test is not supported');
        } else {
            console.log('Touch screen to start AR session and look at the floor or walls');
        }
    } else {
        console.log('WebXR is not supported');
    }
}