import * as THREE from 'three';

export class FractalOverlay {
    constructor() {
        // Shader Material that takes the rendered scene (tDiffuse) and applies distortion & blur
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                tDiffuse: { value: null },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform sampler2D tDiffuse;
                uniform vec2 uResolution;
                varying vec2 vUv;

                // Simplex Noise
                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
                float snoise(vec2 v){
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy) );
                    vec2 x0 = v - i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod(i, 289.0);
                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                        + i.x + vec3(0.0, i1.x, 1.0 ));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m ;
                    m = m*m ;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                // FBM for thick smoke patterns
                float fbm(vec2 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    for (int i = 0; i < 4; i++) {
                        value += amplitude * snoise(p);
                        p *= 2.0;
                        p += 100.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }

                void main() {
                    vec2 uv = vUv;
                    float time = uTime * 0.15; // Smoke drift speed

                    // 1. Generate Noise Mask
                    // Add wandering movement to the noise space
                    vec2 wander = vec2(sin(time * 0.5), cos(time * 0.3)) * 0.5;
                    vec2 noiseUV = uv + wander;

                    // Layer 1: Base flow
                    float n1 = fbm(noiseUV * 1.5 + vec2(time * 0.3, time * 0.1));
                    // Layer 2: Turbulence
                    float n2 = fbm(noiseUV * 4.0 - vec2(time * 0.1, time * 0.2));
                    
                    // Combine
                    float noise = n1 * 0.6 + n2 * 0.4;
                    
                    // Normalize -1..1 to 0..1
                    noise = noise * 0.5 + 0.5;
                    
                    // Contrast to create "thick" areas and clear areas
                    float density = smoothstep(0.35, 0.75, noise);

                    // 2. Distortion
                    // Calculate a distortion vector based on moving noise gradients
                    vec2 distortUV = uv * 3.0 + vec2(time * 0.5, -time * 0.2);
                    vec2 distortOffset = vec2(
                        snoise(distortUV),
                        snoise(distortUV + 100.0)
                    ) * 0.05 * density; // Increased strength

                    vec2 distortedUV = uv + distortOffset;

                    // 3. Blur Simulation (Multi-tap)
                    // Sample texture multiple times around the distorted point
                    float blurAmt = 0.015 * density; // Blur strength depends on smoke density
                    
                    vec4 col = texture2D(tDiffuse, distortedUV);
                    col += texture2D(tDiffuse, distortedUV + vec2(blurAmt, 0.0));
                    col += texture2D(tDiffuse, distortedUV - vec2(blurAmt, 0.0));
                    col += texture2D(tDiffuse, distortedUV + vec2(0.0, blurAmt));
                    col += texture2D(tDiffuse, distortedUV - vec2(0.0, blurAmt));
                    
                    col /= 5.0;

                    // 4. Darkening / Shadow
                    // The smoke itself is dark
                    vec3 smokeColor = vec3(0.0);
                    // Higher density = more smoke color mixed in
                    col.rgb = mix(col.rgb, smokeColor, density * 0.9);

                    gl_FragColor = vec4(col.rgb, 1.0);
                }
            `
        });

        // Fullscreen quad
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.mesh.frustumCulled = false;
    }

    setSize(width, height) {
        if (this.material.uniforms.uResolution) {
            this.material.uniforms.uResolution.value.set(width, height);
        }
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
    }
}