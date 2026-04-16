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

const search_prefixes = ['taxi', 'ts'];
const SPEED_NEVER = 9999; // sentinel: condition never triggers

function fmtMinShow(v) { return v < 0    ? 'disabled' : v + ' kts'; }
function fmtThresh(v)  { return v >= SPEED_NEVER ? 'disabled' : v + ' kts'; }

search(search_prefixes, (query, callback) => {
    if (!query) return;

    const data = query.trim().toLowerCase().split(/\s+/);

    // Only prefix typed → show overview
    if (data.length < 2 || !data[1]) {
        callback([{
            uid: 'taxi_help',
            label: 'Taxi Speed commands',
            subtext: `<p>Current settings: minshow <b>${fmtMinShow(this.widgetStore.speedMinShow)}</b> | warn <b>${fmtThresh(this.widgetStore.speedWarn)}</b> | danger <b>${fmtThresh(this.widgetStore.speedDanger)}</b> | hide <b>${this.widgetStore.speedHideAt} / ${this.widgetStore.speedShowAt} kts</b></p>`
                   + `<p>Usage: taxi minshow &lt;kts&gt; | taxi warn &lt;kts&gt; | taxi danger &lt;kts&gt; | taxi hide &lt;hideAt&gt; &lt;showAt&gt;</p>`
                   + `<p>Use "-" for minshow/warn/danger to disable that threshold.</p>`,
            execute: null
        }]);
        return;
    }

    const cmd = data[1];
    const arg = data[2];

    // --- minshow ---
    if (cmd === 'minshow') {
        const result = { uid: 'taxi_minshow', label: 'TAXI minshow', subtext: '', execute: null };
        if (!arg) {
            result.subtext = `<p>Current: <b>${fmtMinShow(this.widgetStore.speedMinShow)}</b> | Default: <b>${fmtMinShow(DEFAULTS.speedMinShow)}</b></p><p>Enter a value in kts, or "-" to disable.</p>`;
            callback([result]);
            return;
        }
        const isDisable = arg === '-';
        const parsed    = isDisable ? -1 : parseFloat(arg);
        if (!isDisable && isNaN(parsed)) {
            result.subtext = `<p>Invalid value: "${arg}". Enter a number in kts, or "-" to disable.</p>`;
            callback([result]);
            return;
        }
        const newVal = isDisable ? -1 : Math.max(0, parsed);
        result.label   = `TAXI minshow → ${fmtMinShow(newVal)}`;
        result.subtext = `<p>Set minimum show speed to <b>${fmtMinShow(newVal)}</b></p>`;
        result.execute = () => { this.widgetStore.speedMinShow = newVal; this.$api.datastore.export(this.widgetStore); };
        callback([result]);
        return true;
    }

    // --- warn ---
    if (cmd === 'warn') {
        const result = { uid: 'taxi_warn', label: 'TAXI warn', subtext: '', execute: null };
        if (!arg) {
            result.subtext = `<p>Current: <b>${fmtThresh(this.widgetStore.speedWarn)}</b> | Default: <b>${fmtThresh(DEFAULTS.speedWarn)}</b></p><p>Enter a value in kts, or "-" to disable the warning colour.</p>`;
            callback([result]);
            return;
        }
        const isDisable = arg === '-';
        const parsed    = isDisable ? SPEED_NEVER : parseInt(arg);
        if (!isDisable && isNaN(parsed)) {
            result.subtext = `<p>Invalid value: "${arg}". Enter a number in kts, or "-" to disable.</p>`;
            callback([result]);
            return;
        }
        const newVal = isDisable ? SPEED_NEVER : Math.max(1, parsed);
        result.label   = `TAXI warn → ${fmtThresh(newVal)}`;
        result.subtext = `<p>Set warning speed to <b>${fmtThresh(newVal)}</b></p>`;
        result.execute = () => { this.widgetStore.speedWarn = newVal; this.$api.datastore.export(this.widgetStore); };
        callback([result]);
        return true;
    }

    // --- danger ---
    if (cmd === 'danger') {
        const result = { uid: 'taxi_danger', label: 'TAXI danger', subtext: '', execute: null };
        if (!arg) {
            result.subtext = `<p>Current: <b>${fmtThresh(this.widgetStore.speedDanger)}</b> | Default: <b>${fmtThresh(DEFAULTS.speedDanger)}</b></p><p>Enter a value in kts, or "-" to disable the danger colour.</p>`;
            callback([result]);
            return;
        }
        const isDisable = arg === '-';
        const parsed    = isDisable ? SPEED_NEVER : parseInt(arg);
        if (!isDisable && isNaN(parsed)) {
            result.subtext = `<p>Invalid value: "${arg}". Enter a number in kts, or "-" to disable.</p>`;
            callback([result]);
            return;
        }
        const newVal = isDisable ? SPEED_NEVER : Math.max(1, parsed);
        result.label   = `TAXI danger → ${fmtThresh(newVal)}`;
        result.subtext = `<p>Set danger speed to <b>${fmtThresh(newVal)}</b></p>`;
        result.execute = () => { this.widgetStore.speedDanger = newVal; this.$api.datastore.export(this.widgetStore); };
        callback([result]);
        return true;
    }

    // --- hide ---
    if (cmd === 'hide') {
        const result = { uid: 'taxi_hide', label: 'TAXI hide', subtext: '', execute: null };
        if (!arg) {
            result.subtext = `<p>Current: hide at <b>${this.widgetStore.speedHideAt} kts</b>, show again below <b>${this.widgetStore.speedShowAt} kts</b></p>`
                           + `<p>Default: hide at <b>${DEFAULTS.speedHideAt} kts</b>, show again below <b>${DEFAULTS.speedShowAt} kts</b></p>`
                           + `<p>Usage: taxi hide &lt;hideAt&gt; &lt;showAt&gt; — showAt must be at least 1 kt below hideAt.</p>`;
            callback([result]);
            return;
        }
        const hideAt  = parseInt(arg);
        const showArg = data[3];
        if (isNaN(hideAt) || hideAt < 1) {
            result.subtext = `<p>Invalid hideAt value: "${arg}". Enter a positive number in kts.</p>`;
            callback([result]);
            return;
        }
        if (!showArg) {
            result.label   = `TAXI hide → ${hideAt} kts / ?`;
            result.subtext = `<p>hideAt: <b>${hideAt} kts</b> — now enter the showAt value (must be &lt; ${hideAt} kts).</p>`;
            callback([result]);
            return;
        }
        const showAt = parseInt(showArg);
        if (isNaN(showAt) || showAt < 1) {
            result.subtext = `<p>Invalid showAt value: "${showArg}". Enter a positive number in kts.</p>`;
            callback([result]);
            return;
        }
        if (showAt >= hideAt) {
            result.subtext = `<p>showAt (<b>${showAt} kts</b>) must be at least 1 kt below hideAt (<b>${hideAt} kts</b>).</p>`;
            callback([result]);
            return;
        }
        result.label   = `TAXI hide → ${hideAt} kts / show → ${showAt} kts`;
        result.subtext = `<p>Hide widget above <b>${hideAt} kts</b>, show again below <b>${showAt} kts</b></p>`;
        result.execute = () => {
            this.widgetStore.speedHideAt = hideAt;
            this.widgetStore.speedShowAt = showAt;
            this.$api.datastore.export(this.widgetStore);
        };
        callback([result]);
        return true;
    }

    callback([{
        uid: 'taxi_help',
        label: 'TAXI: unknown command',
        subtext: `<p>Unknown command: "${cmd}"</p><p>Available: <b>minshow</b>, <b>warn</b>, <b>danger</b>, <b>hide</b></p>`,
        execute: null
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
