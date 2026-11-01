// 全場共用材質：黏土顆粒、風吹擺動、夜間窗光、水面波動
import * as THREE from 'three';

export const shared = {
  uTime: { value: 0 },
  uGlow: { value: 0 },
  uWind: { value: 1 },
};

const noiseChunk = /* glsl */ `
  float hash31(vec3 p){ p = fract(p * .1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

function patchClay(mat) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uWind = shared.uWind;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSway; uniform float uTime; uniform float uWind; varying vec3 vWPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp0 = modelMatrix * vec4(position, 1.);
        float swayK = aSway * uWind;
        transformed.x += swayK * sin(uTime * 1.7 + wp0.x * .55 + wp0.y * .9) * .09;
        transformed.z += swayK * cos(uTime * 1.3 + wp0.z * .6) * .07;
        vWPos = wp0.xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; ${noiseChunk}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float grain = vnoise(vWPos * 9.) * .55 + vnoise(vWPos * 2.3) * .45;
        diffuseColor.rgb *= .925 + grain * .15;`);
  };
  return mat;
}

const solid = patchClay(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }));

const glow = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0 });
glow.onBeforeCompile = (s) => {
  s.uniforms.uGlow = shared.uGlow;
  s.fragmentShader = s.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uGlow;')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * uGlow * 2.4;`);
};

const water = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.92 });
water.onBeforeCompile = (s) => {
  s.uniforms.uTime = shared.uTime;
  s.vertexShader = s.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vWPos = (modelMatrix * vec4(position, 1.)).xyz;`);
  s.fragmentShader = s.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uTime; varying vec3 vWPos; ${noiseChunk}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float r = vnoise(vec3(vWPos.xz * 1.6, uTime * .35));
      float r2 = vnoise(vec3(vWPos.xz * 3.8 + 7., uTime * .5));
      float crest = smoothstep(.62, .72, r * .6 + r2 * .4);
      diffuseColor.rgb = mix(diffuseColor.rgb * (.86 + r * .28), vec3(.93, .98, 1.), crest * .55);`);
};

export const mats = { solid, glow, water };

// 瀑布：沿帶狀幾何向下捲動的半透明水流
export const fallMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { uTime: shared.uTime, uTint: { value: new THREE.Color('#ffffff') } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
    ${noiseChunk}
    void main(){
      float streak = vnoise(vec3(vUv.x * 9., vUv.y * 5. - uTime * 1.9, uTime * .2));
      float streak2 = vnoise(vec3(vUv.x * 21., vUv.y * 12. - uTime * 2.8, 3.));
      float a = smoothstep(.22, .72, streak * .7 + streak2 * .4);
      float edge = smoothstep(0., .16, vUv.x) * smoothstep(1., .84, vUv.x);
      float fade = smoothstep(0., .05, vUv.y) * smoothstep(1., .55, vUv.y);
      vec3 col = mix(vec3(.62, .84, .95), vec3(1.), a);
      gl_FragColor = vec4(col * uTint, (.3 + a * .65) * edge * fade);
      #include <colorspace_fragment>
    }`,
});
