import React, { useEffect, useRef } from 'react';

const vertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;
const fragmentSource = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPoints[64];
uniform int uPointCount;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
}
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),0.00001),0.0,1.0);
  return length(p-(a+ab*t));
}
vec3 scene(vec2 uv) {
  vec3 col=vec3(0.018,0.032,0.058);
  float a=exp(-length((uv-vec2(0.18,0.8))*vec2(1.0,1.5))*3.0);
  float b=exp(-length((uv-vec2(0.86,0.28))*vec2(1.2,1.0))*3.4);
  float c=exp(-length((uv-vec2(0.52,0.48))*vec2(0.8,1.3))*4.5);
  col+=vec3(0.02,0.24,0.30)*a*0.8+vec3(0.20,0.09,0.34)*b*0.7+vec3(0.02,0.12,0.20)*c*0.75;
  float bands=sin(uv.x*9.0+sin(uv.y*5.0+uTime*0.10)*0.8)*0.5+0.5;
  col+=vec3(0.025,0.055,0.08)*smoothstep(0.88,1.0,bands)*0.22;
  col+=(noise(uv*uResolution*0.35+uTime*0.03)-0.5)*0.035;
  col+=vec3(0.42,0.82,0.92)*pow(max(0.0,1.0-length(uv-vec2(0.18,0.92))),7.0)*0.2;
  return col;
}
void main() {
  vec2 uv=vUv; float field=0.0; float nearestLine=1.0;
  for(int i=0;i<64;i++) {
    if(i>=uPointCount) break;
    vec2 p=uPoints[i]; float d=length(uv-p);
    field+=sin(d*54.0-uTime*3.4)*exp(-d*12.0)*0.0018;
    if(i>0) {
      float ld=segDist(uv,uPoints[i-1],p); nearestLine=min(nearestLine,ld);
      field+=sin(ld*135.0-uTime*2.6)*exp(-ld*22.0)*0.0018;
      uv+=normalize(uv-(uPoints[i-1]+p)*0.5+vec2(0.0001))*exp(-ld*54.0)*0.0007;
    }
  }
  uv=clamp(uv+vec2(field,field*0.7),vec2(0.001),vec2(0.999));
  vec3 col=scene(uv);
  float edge=1.0-smoothstep(0.0,0.035,min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y)));
  float sheen=exp(-vUv.y*22.0)*(0.18+0.12*sin(vUv.x*8.0));
  col+=vec3(0.16,0.46,0.56)*exp(-nearestLine*85.0)*0.045;
  col+=vec3(0.38,0.68,0.78)*edge*0.11+vec3(0.65,0.88,1.0)*sheen*0.10;
  gl_FragColor=vec4(col,1.0);
}
`;

export default function GlassCanvas({ size, activePath }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const uniformsRef = useRef(null);
  useEffect(() => {
    const canvas=canvasRef.current;
    const gl=canvas && canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});
    if(!gl) return;
    const compile=(type,source)=>{
      const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.error('FLOW glass shader:',gl.getShaderInfoLog(shader));gl.deleteShader(shader);return null;}
      return shader;
    };
    const vertex=compile(gl.VERTEX_SHADER,vertexSource), fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
    if(!vertex||!fragment) return;
    const program=gl.createProgram(); gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){console.error('FLOW glass program:',gl.getProgramInfoLog(program));return;}
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    uniformsRef.current={resolution:gl.getUniformLocation(program,'uResolution'),time:gl.getUniformLocation(program,'uTime'),points:gl.getUniformLocation(program,'uPoints[0]'),count:gl.getUniformLocation(program,'uPointCount')};
    glRef.current=gl;
    let frame=0;const start=performance.now();
    const render=now=>{
      const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
      const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.uniform2f(uniformsRef.current.resolution,w,h);gl.uniform1f(uniformsRef.current.time,(now-start)/1000);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      frame=requestAnimationFrame(render);
    };
    frame=requestAnimationFrame(render);
    return ()=>{cancelAnimationFrame(frame);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);uniformsRef.current=null;glRef.current=null;};
  },[]);
  useEffect(()=>{
    const gl=glRef.current,u=uniformsRef.current;if(!gl||!u)return;
    const points=(activePath||[]).slice(-64).map(p=>[(p.c+0.5)/size,1-(p.r+0.5)/size]);
    const data=new Float32Array(128);points.forEach((p,i)=>{data[i*2]=p[0];data[i*2+1]=p[1];});
    gl.uniform2fv(u.points,data);gl.uniform1i(u.count,points.length);
  },[activePath,size]);
  return <canvas ref={canvasRef} className="glass-canvas" aria-hidden="true" />;
}
