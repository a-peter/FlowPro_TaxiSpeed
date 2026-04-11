// Version 0.1
// Author: Ape42

const SPEED_WARN   = 20; // knots — yellow
const SPEED_DANGER = 30; // knots — red

this.host_el    = null;
this.display_el = null;

this.widgetStore = {
    manualHide: false
};

run(() => {
    this.widgetStore.manualHide = !this.widgetStore.manualHide;
});

style(() => {
    const onGround = this.$api.variables.get('A:SIM ON GROUND', 'bool');
    const speed    = this.$api.variables.get('A:GROUND VELOCITY', 'knots');

    if (this.host_el) {
        // Overlay: show when on ground and not manually hidden
        const show = onGround && !this.widgetStore.manualHide;
        this.host_el.classList.toggle('visible', show);

        // Update speed text
        if (this.display_el) {
            this.display_el.textContent = `Speed: ${speed.toFixed(1)} kts`;
        }

        // Speed colour
        this.host_el.classList.remove('speed-ok', 'speed-warn', 'speed-danger');
        if (speed >= SPEED_DANGER) {
            this.host_el.classList.add('speed-danger');
        } else if (speed >= SPEED_WARN) {
            this.host_el.classList.add('speed-warn');
        } else {
            this.host_el.classList.add('speed-ok');
        }
    }

    // Tile state
    if (!onGround) return null;
    if (speed >= SPEED_DANGER) return 'error';
    if (speed >= SPEED_WARN)   return 'armed';
    return 'active';
});

html_created(el => {
    this.host_el    = el.querySelector('#Ape42_taxispeed');
    this.display_el = el.querySelector('#Ape42_taxispeed_display');
    console.log('TaxiSpeed: HTML created');
});
