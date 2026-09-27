/* Original particle sculpture: thousands of fine points and flowing filaments.
   Native WebGL, two draw calls, no textures or external dependencies. */
(() => {
  'use strict';
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aDetail;
    uniform vec2 uViewport;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uDensity;
    uniform float uPoints;
    varying float vAlpha;
    varying float vHue;
    varying float vSpark;
    mat3 turn(float x,float y,float z) {
      float a=cos(x),b=sin(x),c=cos(y),d=sin(y),e=cos(z),f=sin(z);
      return mat3(e,f,0.,-f,e,0.,0.,0.,1.) * mat3(c,0.,-d,0.,1.,0.,d,0.,c) * mat3(1.,0.,0.,0.,a,b,0.,-b,a);
    }
    void main() {
      float t=uTime;
      vec3 p=aPosition;
      float phase=aDetail.x;
      float ripple=sin(p.y*5.+p.x*3.-t*.45)*sin(p.z*4.+t*.24);
      p*=1.+ripple*.045;
      p+=vec3(sin(phase*2.+t*.19),cos(phase*1.3+t*.15),sin(t*.12+phase))*.018;
      mat3 r=turn(.18+sin(t*.08)*.1+uPointer.y*.07,t*.045+uPointer.x*.12,-.34+sin(t*.07)*.06);
      p=r*p;
      p.y+=sin(t*.23)*.045;
      float aspect=uViewport.x/uViewport.y;
      float focal=2.8*(aspect<.8 ? .71 : 1.);
      float depth=5.8-p.z;
      float offset=aspect>1.05 ? .17 : 0.;
      gl_Position=vec4(p.x*focal/aspect+offset*depth,p.y*focal+.07*depth,depth*.96-.2,depth);
      gl_PointSize=clamp(aDetail.z*uDensity*5.8/depth,1.,4.5*uDensity);
      float front=clamp((p.z+2.)/4.,0.,1.);
      float pulse=pow(.5+.5*sin(phase*2.-t*.7),12.);
      vAlpha=aDetail.y*(.18+.82*front)*(.65+.35*sin(phase*4.+t*.48));
      if(uPoints<.5) vAlpha=aDetail.y*(.25+front*.75)*(.5+pulse*1.9);
      vHue=phase*.071+p.z*.045+t*.002;
      vSpark=pulse;
    }
  `;
  const fragment = `
    precision highp float;
    uniform float uPoints;
    varying float vAlpha;
    varying float vHue;
    varying float vSpark;
    void main() {
      vec3 prism=.55+.45*cos(6.2831853*(vHue+vec3(.08,.36,.65)));
      vec3 color=mix(vec3(.68,.81,.96),prism,.34);
      float alpha=vAlpha;
      if(uPoints>.5) {
        float d=length(gl_PointCoord-.5);
        alpha*=smoothstep(.5,.06,d);
        color=mix(color,vec3(.92,.96,1.),vSpark*.5);
      }
      gl_FragColor=vec4(color,alpha);
    }
  `;
  // Deterministic distribution makes the first frame stable across pages.
  const fract=x=>x-Math.floor(x);
  const random=i=>fract(Math.sin(i*127.1+311.7)*43758.5453);
  function geometry(mobile) {
    const dots=[],lines=[];
    const count=mobile?4200:8800;
    for(let i=0;i<count;i++) {
      const y=1-2*(i+.5)/count;
      const angle=i*2.39996323;
      const r=Math.sqrt(1-y*y);
      const corrugation=1+.075*Math.sin(angle*3.+y*8.)+.035*Math.cos(y*17.);
      const shell=i%7===0?.7:1;
      const x=Math.cos(angle)*r*corrugation*1.25*shell;
      const z=Math.sin(angle)*r*corrugation*1.25*shell;
      const bright=i%31===0;
      dots.push(x,y*1.43*shell,z,angle%6.283+y*1.4,bright?1.1:.5+random(i)*.5,bright?2.6:1.15+random(i+3)*.75);
    }
    const rings=mobile?34:58,steps=160;
    const add=(p,phase,alpha)=>lines.push(...p,phase,alpha,1);
    for(let ring=0;ring<rings;ring++) {
      const v=ring/(rings-1),latitude=(v-.5)*2.62;
      const extended=ring%7===0;
      const radius=extended?1.9+random(ring)*.85:Math.cos(latitude)*1.28;
      function point(a) {
        const wave=.025*Math.sin(a*5.+ring*.65);
        let x=(radius+wave)*Math.cos(a),z=(radius+wave)*Math.sin(a);
        let y=extended?.08*Math.sin(a*3.+ring):Math.sin(latitude)*1.44+.075*Math.sin(a*3.+ring*.24);
        const tilt=extended?(ring%3-1)*.55:Math.sin(ring*.3)*.12;
        const py=y*Math.cos(tilt)-z*Math.sin(tilt),pz=y*Math.sin(tilt)+z*Math.cos(tilt);
        return [x,py,pz];
      }
      for(let i=0;i<steps;i++) {
        const a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2;
        const alpha=extended?.16:.12;
        add(point(a),a+ring*.19,alpha);add(point(b),b+ring*.19,alpha);
        // Travelling brightness runs through the same phase along points and lines.
        if(i%5===0) dots.push(...point(a),a+ring*.19,extended?.8:.44,extended?1.9:1.25);
      }
    }
    // Inclined meridians cross the filaments into a fine, irregular lattice.
    for(let ring=0;ring<(mobile?9:16);ring++) {
      const angle=ring/16*Math.PI;
      for(let i=0;i<128;i++) {
        for(const a of [i/128*Math.PI*2,(i+1)/128*Math.PI*2]) {
          const radius=1.27+.04*Math.sin(a*5.+ring);
          add([radius*Math.cos(a)*Math.cos(angle),Math.sin(a)*1.45,radius*Math.cos(a)*Math.sin(angle)],a+ring*.28,.085);
        }
      }
    }
    return {dots:new Float32Array(dots),lines:new Float32Array(lines)};
  }
  window.OorrCrystal={
    create(canvas) {
      const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:true});
      if(!gl)return null;
      const scene=canvas.closest('.cinema-scene');
      let active=false,program,locations,dots,lines,density=1;
      const resources=[];
      function shader(type,source) {
        const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Particle shader could not compile');}
        resources.push(['Shader',s]);return s;
      }
      function buffer(data) {
        const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        resources.push(['Buffer',b]);return {buffer:b,count:data.length/6};
      }
      function dispose(){resources.forEach(([type,item])=>gl['delete'+type](item));resources.length=0;active=false;}
      function setup(){
        resources.length=0;program=gl.createProgram();resources.push(['Program',program]);
        gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Particle program could not link');
        locations={};
        ['uViewport','uPointer','uTime','uDensity','uPoints'].forEach(name=>locations[name]=gl.getUniformLocation(program,name));
        ['aPosition','aDetail'].forEach(name=>locations[name]=gl.getAttribLocation(program,name));
        const data=geometry(innerWidth<821);dots=buffer(data.dots);lines=buffer(data.lines);
        gl.clearColor(0,0,0,0);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);active=true;
      }
      try{setup();}catch(error){dispose();return null;}
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;scene.classList.remove('has-crystal');});
      canvas.addEventListener('webglcontextrestored',()=>{try{setup();canvas.dispatchEvent(new Event('crystalrestore'));}catch(error){dispose();}});
      function draw(mesh,mode){
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
        ['aPosition','aDetail'].forEach((name,i)=>{const p=locations[name];gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,24,i*12);});
        gl.drawArrays(mode,0,mesh.count);
      }
      return {
        resize(width,height,scale=1){
          const mobile=width<821,cap=mobile?1500000:4000000;
          density=Math.min(devicePixelRatio||1,mobile?1.75:2,Math.sqrt(cap/(width*height)))*scale;
          canvas.width=Math.round(width*density);canvas.height=Math.round(height*density);
        },
        render(time,pointer){
          if(!active)return false;
          gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);
          gl.uniform2f(locations.uViewport,canvas.clientWidth,canvas.clientHeight);gl.uniform2f(locations.uPointer,pointer.x,pointer.y);
          gl.uniform1f(locations.uTime,time);gl.uniform1f(locations.uDensity,density);
          gl.uniform1f(locations.uPoints,0);draw(lines,gl.LINES);
          gl.uniform1f(locations.uPoints,1);draw(dots,gl.POINTS);
          scene.classList.add('has-crystal');return true;
        }
      };
    }
  };
})();
