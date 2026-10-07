// Animated contour map behind the hero. Raw WebGL2, no library.
// Without WebGL2 the canvas stays hidden and the CSS gradient shows instead.

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_hover;
out vec4 o_col;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.03 + 11.7;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
    vec2 m = (u_mouse - 0.5 * u_res) / u_res.y;

    // The pointer raises a hill in the height field, so the contours bend around it.
    float d = length(uv - m);
    float bump = exp(-d * d * 9.0) * u_hover;
    float h = fbm(uv * 1.35 + vec2(u_time * 0.018, -u_time * 0.012)) + bump * 0.16;

    float v = h * 15.0;
    float w = min(fwidth(v), 0.35);
    float line = 1.0 - smoothstep(w * 0.7, w * 1.5, abs(fract(v - 0.5) - 0.5));
    float major = step(mod(floor(v + 0.5), 5.0), 0.5);

    vec3 bg = vec3(0.035, 0.043, 0.067);
    vec3 col = bg + h * h * vec3(0.02, 0.032, 0.066);
    vec3 ink = mix(vec3(0.17, 0.22, 0.35), vec3(0.36, 0.62, 1.0), major * 0.55);
    ink = mix(ink, vec3(1.0, 0.416, 0.169), clamp(bump * 1.7, 0.0, 1.0));
    col = mix(col, ink, clamp(line * (0.34 + 0.4 * major + bump * 0.6), 0.0, 1.0));

    float vig = smoothstep(1.3, 0.25, length(uv * vec2(0.8, 1.0)));
    col *= mix(0.5, 1.0, vig);
    o_col = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function start(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = Object.fromEntries(
        ['u_res', 'u_time', 'u_mouse', 'u_hover'].map((name) => [name, gl.getUniformLocation(prog, name)]),
    );

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scale = Math.min(devicePixelRatio || 1, 1.5);
    let visible = true;
    let raf = 0;
    let slowFrames = 0;
    let prev = 0;

    const mouse = { x: 0, y: 0, tx: 0, ty: 0, hover: 0, thover: 0 };

    function resize() {
        const w = Math.max(1, Math.round(canvas.clientWidth * scale));
        const h = Math.max(1, Math.round(canvas.clientHeight * scale));
        if (canvas.width === w && canvas.height === h) return;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }

    function draw(now) {
        resize();
        mouse.x += (mouse.tx - mouse.x) * 0.08;
        mouse.y += (mouse.ty - mouse.y) * 0.08;
        mouse.hover += (mouse.thover - mouse.hover) * 0.06;
        gl.uniform2f(u.u_res, canvas.width, canvas.height);
        gl.uniform1f(u.u_time, still ? 40 : now / 1000);
        gl.uniform2f(u.u_mouse, mouse.x * scale, canvas.height - mouse.y * scale);
        gl.uniform1f(u.u_hover, mouse.hover);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
        raf = 0;
        if (!visible || document.hidden) return;
        draw(now);

        // Drop the render scale if this GPU can't keep up at the current one.
        if (prev && now - prev > 24) slowFrames++;
        else slowFrames = Math.max(0, slowFrames - 1);
        prev = now;
        if (slowFrames > 45 && scale > 0.6) {
            scale = Math.max(0.6, scale * 0.75);
            slowFrames = 0;
        }
        raf = requestAnimationFrame(frame);
    }

    function wake() {
        if (still) {
            draw(0);
        } else if (!raf) {
            prev = 0;
            raf = requestAnimationFrame(frame);
        }
    }

    const hero = canvas.parentElement;
    hero.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.tx = e.clientX - r.left;
        mouse.ty = e.clientY - r.top;
        mouse.thover = 1;
        if (still) {
            Object.assign(mouse, { x: mouse.tx, y: mouse.ty, hover: 1 });
            draw(0);
        }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { mouse.thover = 0; });

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wake();
    }).observe(canvas);
    document.addEventListener('visibilitychange', wake);
    addEventListener('resize', () => { if (still) draw(0); });

    draw(0);
    canvas.classList.add('is-ready');
    wake();
}

const canvas = document.getElementById('hero-gl');
if (canvas) {
    try {
        start(canvas);
    } catch (err) {
        console.warn('hero shader disabled:', err);
    }
}
