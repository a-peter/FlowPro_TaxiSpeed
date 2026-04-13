// Version 1.1.0
// Author: Ape42

this.host_el    = null;
this.display_el = null;

this.widgetStore = {
    // Configurable thresholds (persisted)
    speedMinShow: -1,
    speedWarn:   20,
    speedDanger: 30,
    speedHideAt: 40,
    speedShowAt: 38,
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
