// Version 1.2.0
// Author: Ape42

this.host_el    = null;
this.display_el = null;

const DEFAULTS = { speedMinShow: -1, speedWarn: 20, speedDanger: 30, speedHideAt: 40, speedShowAt: 38 };

this.widgetStore = {
    // Configurable thresholds (persisted)
    speedMinShow: DEFAULTS.speedMinShow,
    speedWarn:    DEFAULTS.speedWarn,
    speedDanger:  DEFAULTS.speedDanger,
    speedHideAt:  DEFAULTS.speedHideAt,
    speedShowAt:  DEFAULTS.speedShowAt,
    // Widget position (persisted)
    posX: null,
    posY: null,
    // Runtime state (not persisted)
    manualHide: false,
    speedHide:  false,
    speed:      0,
    onGround:   false,
};
this.$api.datastore.import(this.widgetStore);
this.widgetStore.manualHide = false; // always start visible
this.widgetStore.speedHide  = false;

settings_define({
    speedMinShow: {
        label: 'Minimum speed (kts)',
        type: 'text',
        description: 'Widget only appears when ground speed is at or above this value.',
        value: this.widgetStore.speedMinShow,
        changed: (value) => {
            this.widgetStore.speedMinShow = Math.max(0, parseFloat(value) || -1);
            this.$api.datastore.export(this.widgetStore);
        }
    },
    speedWarn: {
        label: 'Warning speed (kts)',
        type: 'text',
        description: 'Speed at which the display turns yellow.',
        value: this.widgetStore.speedWarn,
        changed: (value) => {
            this.widgetStore.speedWarn = Math.max(1, parseInt(value) || 20);
            this.$api.datastore.export(this.widgetStore);
        }
    },
    speedDanger: {
        label: 'Danger speed (kts)',
        type: 'text',
        description: 'Speed at which the display turns red.',
        value: this.widgetStore.speedDanger,
        changed: (value) => {
            this.widgetStore.speedDanger = Math.max(1, parseInt(value) || 30);
            this.$api.datastore.export(this.widgetStore);
        }
    },
    speedHideAt: {
        label: 'Hide above (kts)',
        type: 'text',
        description: 'Widget hides when speed exceeds this value (hysteresis upper threshold).',
        value: this.widgetStore.speedHideAt,
        changed: (value) => {
            this.widgetStore.speedHideAt = Math.max(1, parseInt(value) || 40);
            if (this.widgetStore.speedShowAt > this.widgetStore.speedHideAt - 2) {
                this.widgetStore.speedShowAt = Math.max(1, this.widgetStore.speedHideAt - 2);
            }
            this.$api.datastore.export(this.widgetStore);
        }
    },
    speedShowAt: {
        label: 'Show again below (kts)',
        type: 'text',
        description: 'Widget reappears when speed drops below this value (hysteresis lower threshold).',
        value: this.widgetStore.speedShowAt,
        changed: (value) => {
            const parsed = Math.max(1, parseInt(value) || 38);
            this.widgetStore.speedShowAt = Math.min(parsed, this.widgetStore.speedHideAt - 2);
            this.$api.datastore.export(this.widgetStore);
        }
    }
});

const search_prefixes  = ['taxi', 'ts'];
const SPEED_NEVER      = 9999; // sentinel: condition never triggers
const MIN_HYSTERESIS_GAP = 1;

function fmtSpeed(v, disableVal) { return v === disableVal ? 'disabled' : v + ' kts'; }

// Config for the three single-value threshold commands
const THRESHOLD_CMDS = [
    { cmd: 'minshow', uid: 'taxi_minshow', key: 'speedMinShow', disableVal: -1,          parse: parseFloat, minVal: 0, desc: 'Minimum speed to show widget',  syntax: 'taxi minshow &lt;kts&gt;',  helpText: 'use "-" to disable' },
    { cmd: 'warn',    uid: 'taxi_warn',    key: 'speedWarn',    disableVal: SPEED_NEVER, parse: parseInt,   minVal: 1, desc: 'Warning colour threshold',       syntax: 'taxi warn &lt;kts&gt;',     helpText: 'use "-" to disable warning colour' },
    { cmd: 'danger',  uid: 'taxi_danger',  key: 'speedDanger',  disableVal: SPEED_NEVER, parse: parseInt,   minVal: 1, desc: 'Danger colour threshold',        syntax: 'taxi danger &lt;kts&gt;',   helpText: 'use "-" to disable danger colour' },
];

function handleThresholdCmd(cfg, arg, ws, save, callback) {
    const fmt    = (v) => fmtSpeed(v, cfg.disableVal);
    const result = { uid: cfg.uid, label: `TAXI ${cfg.cmd}`, subtext: '', execute: null };
    if (!arg) {
        result.label   = `TAXI ${cfg.cmd} — current: ${fmt(ws[cfg.key])} | default: ${fmt(DEFAULTS[cfg.key])}`;
        result.subtext = `${cfg.syntax}  —  ${cfg.helpText}`;
        callback([result]);
        return;
    }
    const isDisable = arg === '-';
    const parsed    = isDisable ? cfg.disableVal : cfg.parse(arg);
    if (!isDisable && isNaN(parsed)) {
        result.subtext = `Invalid value "${arg}". Enter a number in kts, or "-" to disable.`;
        callback([result]);
        return;
    }
    const newVal = isDisable ? cfg.disableVal : Math.max(cfg.minVal, parsed);
    result.label   = `TAXI ${cfg.cmd} → ${fmt(newVal)}`;
    result.subtext = `Set ${cfg.desc.toLowerCase()} to ${fmt(newVal)}`;
    result.execute = () => { ws[cfg.key] = newVal; save(); };
    callback([result]);
    return true;
}

search(search_prefixes, (query, callback) => {
    if (!query) return;

    const ws   = this.widgetStore;
    const save = () => this.$api.datastore.export(ws);
    const data = query.trim().toLowerCase().split(/\s+/);

    if (data.length < 2 || !data[1]) {
        callback([
            ...THRESHOLD_CMDS.map(cfg => ({
                uid:     cfg.uid,
                label:   `TAXI ${cfg.cmd} — ${fmtSpeed(ws[cfg.key], cfg.disableVal)}`,
                subtext: `${cfg.desc}. Default: ${fmtSpeed(DEFAULTS[cfg.key], cfg.disableVal)}. Use "-" to disable.`,
                execute: null,
            })),
            {
                uid:     'taxi_hide',
                label:   `TAXI hide — ${ws.speedHideAt} / ${ws.speedShowAt} kts`,
                subtext: `Hysteresis: hide above X, show again below Y. Default: ${DEFAULTS.speedHideAt} / ${DEFAULTS.speedShowAt} kts.`,
                execute: null,
            },
        ]);
        return;
    }

    const cmd = data[1];
    const arg = data[2];

    const threshCfg = THRESHOLD_CMDS.find(c => c.cmd === cmd);
    if (threshCfg) return handleThresholdCmd(threshCfg, arg, ws, save, callback);

    if (cmd === 'hide') {
        const result = { uid: 'taxi_hide', label: 'TAXI hide', subtext: '', execute: null };
        if (!arg) {
            result.label   = `TAXI hide — current: ${ws.speedHideAt} / ${ws.speedShowAt} kts | default: ${DEFAULTS.speedHideAt} / ${DEFAULTS.speedShowAt} kts`;
            result.subtext = `taxi hide &lt;hideAt&gt; &lt;showAt&gt;  —  showAt must be at least ${MIN_HYSTERESIS_GAP} kt below hideAt`;
            callback([result]);
            return;
        }
        const hideAt  = parseInt(arg);
        const showArg = data[3];
        if (isNaN(hideAt) || hideAt < 1) {
            result.subtext = `Invalid hideAt "${arg}". Enter a positive number in kts.`;
            callback([result]);
            return;
        }
        if (!showArg) {
            result.label   = `TAXI hide → ${hideAt} kts / ?`;
            result.subtext = `Now enter showAt (must be < ${hideAt} kts): taxi hide ${hideAt} &lt;showAt&gt;`;
            callback([result]);
            return;
        }
        const showAt = parseInt(showArg);
        if (isNaN(showAt) || showAt < 1) {
            result.subtext = `Invalid showAt "${showArg}". Enter a positive number in kts.`;
            callback([result]);
            return;
        }
        if (hideAt - showAt < MIN_HYSTERESIS_GAP) {
            result.subtext = `showAt (${showAt} kts) must be at least ${MIN_HYSTERESIS_GAP} kt below hideAt (${hideAt} kts).`;
            callback([result]);
            return;
        }
        result.label   = `TAXI hide → ${hideAt} kts / show → ${showAt} kts`;
        result.subtext = `Hide above ${hideAt} kts, show again below ${showAt} kts`;
        result.execute = () => { ws.speedHideAt = hideAt; ws.speedShowAt = showAt; save(); };
        callback([result]);
        return true;
    }

    callback([{
        uid:     'taxi_unknown',
        label:   `TAXI: unknown command "${cmd}"`,
        subtext: 'Available: minshow, warn, danger, hide',
        execute: null,
    }]);
});

run(() => {
    this.widgetStore.manualHide = !this.widgetStore.manualHide;
});

loop_15hz(() => {
    const onGround = this.$api.variables.get('A:SIM ON GROUND', 'bool');
    const speed    = this.$api.variables.get('A:GROUND VELOCITY', 'knots');

    this.widgetStore.onGround = onGround;
    this.widgetStore.speed    = speed;

    if (!this.host_el) return;

    // Hysteresis
    if (speed >= this.widgetStore.speedHideAt)       this.widgetStore.speedHide = true;
    else if (speed < this.widgetStore.speedShowAt)   this.widgetStore.speedHide = false;

    // Overlay visibility
    const show = onGround && !this.widgetStore.manualHide && !this.widgetStore.speedHide && speed >= this.widgetStore.speedMinShow;
    this.host_el.classList.toggle('visible', show);

    // Speed text
    if (this.display_el) {
        this.display_el.textContent = `Speed: ${speed.toFixed(1)} kts`;
    }

    // Speed colour
    this.host_el.classList.remove('speed-ok', 'speed-warn', 'speed-danger');
    if (speed >= this.widgetStore.speedDanger)      this.host_el.classList.add('speed-danger');
    else if (speed >= this.widgetStore.speedWarn)   this.host_el.classList.add('speed-warn');
    else                                            this.host_el.classList.add('speed-ok');

    // Persist position if changed after a drag
    const posX = parseInt(this.host_el.style.left) || 0;
    const posY = parseInt(this.host_el.style.top)  || 0;
    if (posX !== this.widgetStore.posX || posY !== this.widgetStore.posY) {
        this.widgetStore.posX = posX;
        this.widgetStore.posY = posY;
        this.$api.datastore.export(this.widgetStore);
    }
});

style(() => {
    const { onGround, speed, speedWarn, speedDanger } = this.widgetStore;
    if (!onGround)           return null;
    if (speed >= speedDanger) return 'error';
    if (speed >= speedWarn)   return 'armed';
    return 'active';
});

info(() => {
    return `Taxi Speed\n${this.widgetStore.speed.toFixed(1)} kts`;
});

html_created(el => {
    this.host_el    = el.querySelector('#Ape42_taxispeed');
    this.display_el = el.querySelector('#Ape42_taxispeed_display');

    // Restore saved position
    if (this.widgetStore.posX !== null) {
        this.host_el.style.left = `${this.widgetStore.posX}px`;
        this.host_el.style.top  = `${this.widgetStore.posY}px`;
    }

    console.log('TaxiSpeed: HTML created');
});
