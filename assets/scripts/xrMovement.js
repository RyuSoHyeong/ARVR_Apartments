export function createXrMovement(app, cameraEntity, rootEntity, opts = {}) {
    const movementSpeed = opts.movementSpeed ?? 1.5;
    const snapAngleDeg  = opts.snapAngleDeg  ?? 45;
    const rotateThreshold = opts.rotateThreshold ?? 0.5;
    const rotateResetThreshold = opts.rotateResetThreshold ?? 0.25;
    const smoothRotate = !!opts.smoothRotate;
    const smoothRotateSpeedDeg = opts.smoothRotateSpeedDeg ?? 120;
    const deadzone = opts.deadzone ?? 0.15;

    const controllers = new Set();
    let enabled = false;
    let lastRotateValue = 0;
    const v2A = new pc.Vec2();
    const v2B = new pc.Vec2();

    // не фильтруем по gamepad здесь — он может появиться позже
    const onAdd = (inputSource) => {
        controllers.add(inputSource);
        inputSource?.on?.('remove', () => controllers.delete(inputSource));
    };
    const onRemove = (inputSource) => controllers.delete(inputSource);

    const readAxis = (gp, i) => {
        const v = (gp?.axes && gp.axes.length > i) ? gp.axes[i] : 0;
        return Math.abs(v) < deadzone ? 0 : v;
    };
    const readAxisAny = (gp, a, b) => {
        const va = readAxis(gp, a);
        return va !== 0 ? va : readAxis(gp, b);
    };

    const update = (dt) => {
        if (!enabled || !app.xr.active || controllers.size === 0) return;

        for (const inputSource of controllers) {
            const gp = inputSource.gamepad;
            if (!gp) continue; // gamepad ещё не подвезли — ждём следующий кадр

            if (inputSource.handedness === 'left') {
                // движение: оси могут быть [0,1] или [2,3]
                const lx = -readAxisAny(gp, 0, 2); // strafe
                const ly = -readAxisAny(gp, 1, 3); // forward/back

                if (lx !== 0 || ly !== 0) {
                    v2A.set(lx, ly).normalize();

                    // направление камеры по XZ
                    v2B.set(cameraEntity.forward.x, cameraEntity.forward.z).normalize();
                    const rad = Math.atan2(v2B.x, v2B.y) - Math.PI / 2;

                    // поворот джойстика в пространство камеры
                    const rx = v2A.x * Math.sin(rad) - v2A.y * Math.cos(rad);
                    const rz = v2A.y * Math.sin(rad) + v2A.x * Math.cos(rad);

                    rootEntity.translate(rx * movementSpeed * dt, 0, rz * movementSpeed * dt);
                }
            } else if (inputSource.handedness === 'right') {
                // поворот: горизонталь правого стика часто 0, иногда 2
                const rotateAxis = readAxisAny(gp, 0, 2);

                if (smoothRotate) {
                    if (Math.abs(rotateAxis) > 0) {
                        rootEntity.rotateLocal(0, rotateAxis * smoothRotateSpeedDeg * dt, 0);
                    }
                } else {
                    if (lastRotateValue > 0 && rotateAxis < rotateResetThreshold) lastRotateValue = 0;
                    else if (lastRotateValue < 0 && rotateAxis > -rotateResetThreshold) lastRotateValue = 0;

                    if (lastRotateValue === 0 && Math.abs(rotateAxis) > rotateThreshold) {
                        lastRotateValue = Math.sign(rotateAxis);
                        rootEntity.rotateLocal(0, Math.sign(rotateAxis) * snapAngleDeg, 0);
                    }
                }
            }
        }
    };

    const api = {
        enable()  { enabled = true;  console.log('[XR MOVE] enabled'); },
        disable() { enabled = false; console.log('[XR MOVE] disabled'); },
        destroy() {
            enabled = false;
            app.off('update', update);
            app.xr?.input?.off?.('add', onAdd);
            app.xr?.input?.off?.('remove', onRemove);
            controllers.clear();
        }
    };

    app.on('update', update);

    if (app.xr?.input) {
        app.xr.input.on('add', onAdd);
        app.xr.input.on('remove', onRemove);
        // добавить уже существующие источники, даже если у них пока нет gamepad
        if (app.xr.input.inputSources) {
            for (const is of app.xr.input.inputSources) controllers.add(is);
        }
    }

    return api;
}
