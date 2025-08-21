var TriggerObjectActivator = pc.createScript('triggerObjectActivator');

TriggerObjectActivator.attributes.add('targetEntities', {
    type: 'entity', array: true, title: 'Target Entities'
});

TriggerObjectActivator.attributes.add('debounceMs', {
    type: 'number', default: 120, title: 'Debounce (ms)'
});

TriggerObjectActivator.attributes.add('disableDepthForTargets', {
    type: 'boolean', default: false, title: 'Disable Depth On Targets'
});

if (!window._triggerObjectCounter) window._triggerObjectCounter = new Map();
if (!window._layerRequests) window._layerRequests = new Map();
if (!window._layerOps) window._layerOps = [];
if (!window._layerSeq) window._layerSeq = 1;

if (window._scheduleLayerFlush === undefined) {
    window._layerFlushScheduled = false;
    window._scheduleLayerFlush = function (app) {
        if (!window._layerFlushScheduled) {
            window._layerFlushScheduled = true;
            app.once('postUpdate', function () {
                window._layerFlushScheduled = false;
                _flushLayerOps(app);
            });
        }
    };
}

function _flushLayerOps(app) {
    const ops = window._layerOps;
    if (!ops.length) return;

    const affected = new Set();

    for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (op.type !== 'enter') continue;
        let map = window._layerRequests.get(op.ent);
        if (!map) {
            map = new Map();
            window._layerRequests.set(op.ent, map);
        }
        map.set(op.triggerId, { layerId: op.layerId, seq: op.seq });
        affected.add(op.ent);
    }

    for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (op.type !== 'leave') continue;
        const map = window._layerRequests.get(op.ent);
        if (map) {
            map.delete(op.triggerId);
            if (!map.size) window._layerRequests.delete(op.ent);
        }
        affected.add(op.ent);
    }

    window._layerOps.length = 0;

    for (const ent of affected) {
        const reqMap = window._layerRequests.get(ent);
        if (!reqMap || !reqMap.size) continue;

        let best = null;
        for (const r of reqMap.values()) {
            if (!best || r.seq > best.seq) best = r;
        }
        if (!best) continue;

        _applyEntityLayer(ent, best.layerId);
    }
}

function _applyEntityLayer(ent, desiredLayerId) {
    const comp = ent.gsplat ? ent.gsplat : (ent.render ? ent.render : (ent.element ? ent.element : null));
    if (!comp) return;

    const curArr = comp.layers;
    const curId = (curArr && curArr.length === 1) ? curArr[0] : null;
    if (curId === desiredLayerId) return;

    comp.layers = [desiredLayerId];

    if (ent.gsplat && ent.gsplat._onLayersChanged) {
        ent.gsplat._onLayersChanged();
    }
}

TriggerObjectActivator.prototype.initialize = function () {
    this._targets = (this.targetEntities || []).filter(Boolean);
    this._isInside = false;
    this._enterTimer = null;
    this._leaveTimer = null;
    this._id = pc.guid.create();

    if (this.entity.collision) {
        this.entity.collision.on('triggerenter', this.onEnter, this);
        this.entity.collision.on('triggerleave', this.onLeave, this);
    }

    if (this.disableDepthForTargets) {
        for (const ent of this._targets) {
            if (ent.render) {
                for (const mi of ent.render.meshInstances) {
                    mi.material.depthTest = false;
                    mi.material.depthWrite = false;
                    mi.material.update();
                }
            }
        }
    }
};

TriggerObjectActivator.prototype.onEnter = function (other) {
    if (!this._isTracked(other)) return;

    if (this._leaveTimer) {
        clearTimeout(this._leaveTimer);
        this._leaveTimer = null;
    }

    if (this._isInside) return;

    if (!this._enterTimer) {
        this._enterTimer = setTimeout(() => {
            this._enterTimer = null;
            this._setInside(true);
        }, this.debounceMs);
    }
};

TriggerObjectActivator.prototype.onLeave = function (other) {
    if (!this._isTracked(other)) return;

    if (this._enterTimer) {
        clearTimeout(this._enterTimer);
        this._enterTimer = null;
    }

    if (!this._isInside) return;

    if (!this._leaveTimer) {
        this._leaveTimer = setTimeout(() => {
            this._leaveTimer = null;
            this._setInside(false);
        }, this.debounceMs);
    }
};

TriggerObjectActivator.prototype._setInside = function (flag) {
    const counter = window._triggerObjectCounter;
    this._isInside = flag;

    for (let i = 0; i < this._targets.length; i++) {
        const ent = this._targets[i];

        const prev = counter.get(ent) || 0;
        const next = Math.max(0, prev + (flag ? 1 : -1));
        counter.set(ent, next);
        ent.enabled = next > 0;

        const layerName = String(i + 1);
        const layer = this.app.scene.layers.getLayerByName(layerName);
        if (!layer) {
            console.warn(`Layer '${layerName}' not found for ${ent.name}`);
            continue;
        }
        const layerId = layer.id;

        if (flag) {
            window._layerOps.push({
                type: 'enter',
                ent,
                triggerId: this._id,
                layerId,
                seq: window._layerSeq++
            });
        } else {
            window._layerOps.push({
                type: 'leave',
                ent,
                triggerId: this._id
            });
        }

        window._scheduleLayerFlush(this.app);
    }
};

TriggerObjectActivator.prototype._isTracked = function (other) {
    return other && other.name === 'CameraTrigger';
};