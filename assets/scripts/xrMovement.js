export function createXrMovement(app, cameraEntity, rootEntity, opts = {}) {
    const movementSpeed           = opts.movementSpeed ?? 1.5;
    const snapAngleDeg            = opts.snapAngleDeg ?? 45;
    const rotateThreshold         = opts.rotateThreshold ?? 0.5;
    const rotateResetThreshold    = opts.rotateResetThreshold ?? 0.25;
    const smoothRotate            = !!opts.smoothRotate;
    const smoothRotateSpeedDeg    = opts.smoothRotateSpeedDeg ?? 120;
    const deadzone                = opts.deadzone ?? 0.15;

    const rotationMode            = opts.rotationMode ?? 'aroundCamera';

    const allowGamepadFallback    = opts.allowGamepadFallback ?? true;
    const gamepadIndex            = opts.gamepadIndex ?? 0;

    const axesRemap = {
        leftX:  opts.axesRemap?.leftX  ?? [0, 2],
        leftY:  opts.axesRemap?.leftY  ?? [1, 3],
        rightX: opts.axesRemap?.rightX ?? [2, 0],
        rightY: opts.axesRemap?.rightY ?? [3, 1],
    };

    const controllers = new Set();
    let enabled = false;
    let lastRotateValue = 0;

    const v2A = new pc.Vec2();
    const v2B = new pc.Vec2();

    const onAdd = (inputSource) => {
        controllers.add(inputSource);
        inputSource?.on?.('remove', () => controllers.delete(inputSource));
    };
    const onRemove = (inputSource) => controllers.delete(inputSource);

    const readAxis = (arr, i, dz) => {
        const v = (arr && arr.length > i) ? arr[i] : 0;
        return Math.abs(v) < dz ? 0 : v;
    };
    const readAxisAny = (arr, a, b, dz) => {
        const va = readAxis(arr, a, dz);
        return va !== 0 ? va : readAxis(arr, b, dz);
    };

    const camEnt = /** @type {pc.Entity} */ (cameraEntity?.entity || cameraEntity);

    function yawAroundCamera(deg) {
        if (rotationMode === 'root') {
            rootEntity.rotateLocal(0, deg, 0);
            return;
        }

        const parent = rootEntity.parent || null;

        const pivotWorld = camEnt.getPosition().clone();

        let invParentWorld = null;
        let parentWorldRot = null;
        let invParentWorldRot = null;

        if (parent) {
            invParentWorld = new pc.Mat4().copy(parent.getWorldTransform()).invert();
            parentWorldRot = parent.getRotation().clone();
            invParentWorldRot = parentWorldRot.clone().invert();
        } else {
            invParentWorld = new pc.Mat4().isIdentity();
            parentWorldRot = new pc.Quat(); parentWorldRot.set(0, 0, 0, 1);
            invParentWorldRot = new pc.Quat(); invParentWorldRot.set(0, 0, 0, 1);
        }

        const qYawWorld = new pc.Quat().setFromEulerAngles(0, deg, 0);
        const qLocal = new pc.Quat();
        qLocal.mul2(invParentWorldRot, qYawWorld);
        qLocal.mul(parentWorldRot);

        const pivotLocal = new pc.Vec3();
        invParentWorld.transformPoint(pivotWorld, pivotLocal);

        const lp = rootEntity.getLocalPosition().clone();
        const rel = lp.clone().sub(pivotLocal);
        qLocal.transformVector(rel, rel);
        const newLocalPos = pivotLocal.add(rel);
        rootEntity.setLocalPosition(newLocalPos);

        const lr = rootEntity.getLocalRotation().clone();
        const newLocalRot = new pc.Quat();
        newLocalRot.mul2(qLocal, lr);
        rootEntity.setLocalRotation(newLocalRot);
    }

    function moveRelativeToCamera(dx, dz, dt) {
        if (dx === 0 && dz === 0) return;
        v2A.set(dx, dz).normalize();

        v2B.set(camEnt.forward.x, camEnt.forward.z);
        if (v2B.lengthSq() === 0) return;
        v2B.normalize();

        const rad = Math.atan2(v2B.x, v2B.y) - Math.PI / 2;
        const rx = v2A.x * Math.sin(rad) - v2A.y * Math.cos(rad);
        const rz = v2A.y * Math.sin(rad) + v2A.x * Math.cos(rad);
        rootEntity.translate(rx * movementSpeed * dt, 0, rz * movementSpeed * dt);
    }

    function applyRotationFromAxis(axisX, dt) {
        if (smoothRotate) {
            if (Math.abs(axisX) > 0) yawAroundCamera(axisX * smoothRotateSpeedDeg * dt);
            return;
        }
        if (lastRotateValue > 0 && axisX < rotateResetThreshold) lastRotateValue = 0;
        else if (lastRotateValue < 0 && axisX > -rotateResetThreshold) lastRotateValue = 0;

        if (lastRotateValue === 0 && Math.abs(axisX) > rotateThreshold) {
            lastRotateValue = Math.sign(axisX);
            yawAroundCamera(Math.sign(axisX) * snapAngleDeg);
        }
    }

    const update = (dt) => {
        if (!enabled || !app.xr.active) return;

        let consumed = false;

        if (controllers.size > 0) {
            for (const inputSource of controllers) {
                const gp = inputSource.gamepad;
                if (!gp) continue;

                if (inputSource.handedness === 'left') {
                    const lx = -readAxisAny(gp.axes, axesRemap.leftX[0],  axesRemap.leftX[1],  deadzone);
                    const ly = -readAxisAny(gp.axes, axesRemap.leftY[0],  axesRemap.leftY[1],  deadzone);
                    moveRelativeToCamera(lx, ly, dt);
                    consumed = true;
                } else if (inputSource.handedness === 'right') {
                    const rx =  readAxisAny(gp.axes, axesRemap.rightX[0], axesRemap.rightX[1], deadzone);
                    applyRotationFromAxis(rx, dt);
                    consumed = true;
                }
            }
        }

        if (!consumed && allowGamepadFallback && typeof navigator !== 'undefined' && navigator.getGamepads) {
            const padsRaw = navigator.getGamepads?.() || [];
            const pads = padsRaw.filter(p => p && p.axes && p.axes.length >= 2);
            if (pads.length) {
                const gp = pads[opts.gamepadIndex ?? gamepadIndex] || pads[0];

                if (!update._axisMap) update._axisMap = { left: null, rightX: null };

                const explicit = opts.axesRemapExplicit;
                if (explicit && Array.isArray(explicit.left) && explicit.left.length === 2 && Number.isInteger(explicit.rightX)) {
                    update._axisMap.left  = explicit.left;
                    update._axisMap.rightX = explicit.rightX;
                }

                const axes = gp.axes || [];

                const pickAxisPair = (a, b) => {
                    const av = Math.abs(axes[a] || 0);
                    const bv = Math.abs(axes[b] || 0);
                    return { pair:[a,b], score: av*av + bv*bv };
                };

                if (!update._axisMap.left || !update._axisMap.rightX) {
                    const pairs = [];
                    if (axes.length >= 2) pairs.push(pickAxisPair(0,1));
                    if (axes.length >= 4) pairs.push(pickAxisPair(2,3));
                    if (axes.length >= 6) pairs.push(pickAxisPair(4,5));
                    if (pairs.length === 0) pairs.push({ pair:[0,1], score: 0 });

                    pairs.sort((a,b) => b.score - a.score);
                    const leftPair = (update._axisMap.left ?? pairs[0].pair).slice(0,2);

                    const leftSet = new Set(leftPair);
                    let bestIdx = null, bestScore = 0;
                    for (let i = 0; i < axes.length; i++) {
                        if (leftSet.has(i)) continue;
                        const s = Math.abs(axes[i] || 0);
                        if (s > bestScore) { bestScore = s; bestIdx = i; }
                    }
                    if (bestIdx == null) {
                        bestIdx = (leftPair[0] === 0 && leftPair[1] === 1) ? 2 : 0;
                    }

                    update._axisMap.left = leftPair;
                    update._axisMap.rightX = bestIdx;

                    if (!opts._loggedGamepadOnce) {
                        console.log('[XR MOVE] Single-gamepad fallback: axes=', axes.length, 'id=', gp.id);
                        console.log('[XR MOVE] Chosen axes: left=', leftPair, ' rightX=', bestIdx);
                        opts._loggedGamepadOnce = true;
                    }
                }

                const [lxIdx, lyIdx] = update._axisMap.left;
                const rxIdx = update._axisMap.rightX;

                const lx = -(Math.abs(axes[lxIdx]) > deadzone ? axes[lxIdx] : 0);
                const ly = -(Math.abs(axes[lyIdx]) > deadzone ? axes[lyIdx] : 0);
                const rx =  (Math.abs(axes[rxIdx]) > deadzone ? axes[rxIdx] : 0);

                moveRelativeToCamera(lx, ly, dt);
                applyRotationFromAxis(rx, dt);
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
        if (app.xr.input.inputSources) {
            for (const is of app.xr.input.inputSources) controllers.add(is);
        }
    }

    return api;
}