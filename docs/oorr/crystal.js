/* Soft-edged particle planet with brief shape disruptions and orbital agents.
   Native WebGL, two draw calls, no textures or external dependencies. */
(() => {
  'use strict';
  const vertex = `
    attribute vec3 aPosition;
    attribute vec3 aDetail;
    attribute vec3 aMotion;
    uniform vec2 uViewport;
    uniform vec2 uPointer;
    uniform float uTime;
    uniform float uDensity;
    uniform float uPoints;
    varying float vAlpha;
    varying float vHue;
    varying float vSpark;
    varying float vAgent;
    mat3 turn(float x,float y,float z) {
      float a=cos(x),b=sin(x),c=cos(y),d=sin(y),e=cos(z),f=sin(z);
      return mat3(e,f,0.,-f,e,0.,0.,0.,1.) * mat3(c,0.,-d,0.,1.,0.,d,0.,c) * mat3(1.,0.,0.,0.,a,b,0.,-b,a);
    }
    void main() {
      float t=uTime,phase=aDetail.x,kind=aMotion.x;
      vec3 p=aPosition;
      // A brief, smooth disruption in each nine-second breathing cycle.
      float cycle=mod(t,9.);
      float breakaway=smoothstep(7.1,7.5,cycle)*(1.-smoothstep(8.,8.5,cycle));
      if(kind<1.5) {
        vec3 n=normalize(p+vec3(.0001));
        float ripple=sin(p.y*4.+p.z*3.-t*.4)*sin(p.x*3.+t*.23);
        p*=1.+ripple*.055+sin(t*.42)*.025;
        p.x*=1.+breakaway*.26;
        p.y*=1.-breakaway*.16;
        p+=breakaway*vec3(.32*sin(p.y*3.4+t*.5),.24*sin(p.x*3.5-t*.7),.2*cos(p.y*3.+t*.4));
        p+=n*(.02*sin(phase*2.+t*.7)+breakaway*(.06+.17*aMotion.y)*sin(phase*1.7+t));
        // Feathered outskirts drift independently; there is no hard spherical edge.
        p+=vec3(sin(phase+t*.2),cos(phase*1.3+t*.17),sin(phase*1.7-t*.16))*(.014+aMotion.y*.045+breakaway*aMotion.y*.13);
      } else {
        // Ring paths and satellites share exactly the same orbital geometry.
        float a=aPosition.x+(kind>2.5?t*aMotion.y:0.);
        float radius=aPosition.y,tilt=aPosition.z+sin(t*.06+aMotion.z)*.025;
        vec3 q=vec3(cos(a)*radius,-sin(a)*radius*sin(tilt),sin(a)*radius*cos(tilt));
        p=turn(0.,0.,aMotion.z)*q;
      }
      p=turn(.12+sin(t*.07)*.06+uPointer.y*.06,t*.035+uPointer.x*.1,-.17)*p;
      p.y+=sin(t*.23)*.03;
      float aspect=uViewport.x/uViewport.y;
      float focal=2.8*(aspect<.8?.66:1.);
      float depth=6.-p.z;
      float offset=aspect>1.05?.17:0.;
      gl_Position=vec4(p.x*focal/aspect+offset*depth,p.y*focal+.055*depth,depth*.96-.2,depth);
      gl_PointSize=clamp(aDetail.z*uDensity*6./depth,1.,22.*uDensity);
      float front=clamp((p.z+2.7)/5.4,0.,1.);
      float pulse=pow(.5+.5*sin(phase*2.-t*.65),10.);
      vAlpha=aDetail.y*(.28+.72*front)*(.78+.22*sin(phase*4.+t*.48));
      if(uPoints<.5) vAlpha=aDetail.y*(.35+front*.65)*(.7+pulse*.8);
      vHue=phase*.071+p.z*.035+t*.002;
      vSpark=pulse;
      vAgent=kind>3.5?1.:0.;
      if(kind>1.5) {
        // Back-side arcs recede into the cloud while front-side satellites stay bright.
        float behind=(1.-smoothstep(-.2,.2,p.z))*(1.-smoothstep(.82,1.45,length(p.xy)));
        vAlpha*=1.-behind*.75;
      }
      if(vAgent>.5) {vAlpha*=1.5;vHue=phase*.13;}
    }
  `;
  const fragment = `
    precision highp float;
    uniform float uPoints;
    varying float vAlpha;
    varying float vHue;
    varying float vSpark;
    varying float vAgent;
    void main() {
      vec3 prism=.55+.45*cos(6.2831853*(vHue+vec3(.08,.36,.65)));
      vec3 color=mix(vec3(.68,.81,.96),prism,vAgent>.5?.46:.29);
      float alpha=vAlpha;
      if(uPoints>.5) {
        float d=length(gl_PointCoord-.5);
        alpha*=smoothstep(.5,.035,d);
        color=mix(color,vec3(.94,.97,1.),vSpark*.42+vAgent*.25);
      }
      gl_FragColor=vec4(color,alpha);
    }
  `;
  const fract=x=>x-Math.floor(x);
  const random=i=>fract(Math.sin(i*127.1+311.7)*43758.5453);
  // radius, inclination, screen tilt, angular speed (radians/second)
  const orbits=[
    [1.76,.39,-.3,.23], [1.94,.43,-.3,-.18], [2.12,.47,-.3,.15],
    [2.29,1.08,.52,-.12], [2.43,-.82,-.76,.105]
  ];
  function geometry(mobile) {
    const dots=[],lines=[];
    // Four times the previous scene's complete dot budget; all extra dots
    // go into the planet. Ambient counts remain 620 desktop / 240 mobile.
    const total=4*(mobile?5528:11276),ambient=mobile?240:620;
    const orbitDust=mobile?512:1024,agentDots=8*22;
    const count=total-ambient-orbitDust-agentDots;
    const dot=(p,phase,alpha,size,motion)=>dots.push(...p,phase,alpha,size,...motion);
    const line=(p,phase,alpha,motion)=>lines.push(...p,phase,alpha,1,...motion);
    for(let i=0;i<count;i++) {
      const y=1-2*(i+.5)/count,angle=i*2.39996323,r=Math.sqrt(1-y*y);
      const distribution=random(i+14);
      let radius;
      if(distribution<.66) radius=.2+Math.cbrt(random(i+31))*.87;
      else if(distribution<.92) radius=.94+random(i+17)*.26;
      else radius=1.15+Math.pow(random(i+49),1.6)*.62;
      const edge=Math.max(0,(radius-1.05)/.72);
      const corrugation=1+.018*Math.sin(angle*3.+y*7.);
      const p=[Math.cos(angle)*r*radius*corrugation,y*radius*1.055,Math.sin(angle)*r*radius*corrugation];
      const bright=i%79===0;
      const alpha=(bright?1.05:.4+random(i)*.4)*(1-edge*.83);
      dot(p,angle%6.283+y*1.4,alpha,bright?2.05:.95+random(i+3)*.65,[0,edge,0]);
    }
    // Open, deforming filaments inside the cloud, without a closing wire cage.
    const filaments=mobile?22:38,steps=140;
    for(let j=0;j<filaments;j++) {
      const latitude=(j/(filaments-1)-.5)*2.4,phase=random(j+44)*6.28;
      function point(a) {
        const r=Math.cos(latitude)*1.03+.035*Math.sin(a*4.+j);
        return [r*Math.cos(a),Math.sin(latitude)*1.09+.055*Math.sin(a*3.+j*.3),r*Math.sin(a)];
      }
      for(let i=0;i<steps;i++) {
        const a=phase+i/steps*4.7,b=phase+(i+1)/steps*4.7;
        line(point(a),a+j*.2,.04,[1,0,0]);line(point(b),b+j*.2,.04,[1,0,0]);
      }
    }
    // Three close Saturn-like ring bands, plus two inclined satellite tracks.
    orbits.forEach(([radius,tilt,twist],index)=>{
      const contours=index<3?3:1;
      for(let band=0;band<contours;band++) {
        const r=radius+(band-(contours-1)/2)*.015;
        const alpha=band===Math.floor(contours/2)?(index<3?.34:.2):.11;
        for(let i=0;i<240;i++) {
          for(const a of [i/240*Math.PI*2,(i+1)/240*Math.PI*2]) line([a,r,tilt],a+index*.7,alpha,[2,0,twist]);
        }
      }
    });
    for(let i=0;i<orbitDust;i++) {
      const index=i%3,[radius,tilt,twist,speed]=orbits[index];
      dot([random(i+204)*Math.PI*2,radius+(random(i+401)-.5)*.025,tilt],i*.07,.2+random(i+50)*.24,.85+random(i+27)*.4,[3,speed*.25,twist]);
    }
    for(let agent=0;agent<8;agent++) {
      const index=agent%orbits.length,[radius,tilt,twist,speed]=orbits[index];
      const phase=agent*2.39996323;
      const motion=[4,speed,twist];
      // A bright node, soft halo and tapered trail mark each visual agent.
      dot([phase,radius,tilt],agent,1.15,5.5,motion);
      dot([phase,radius,tilt],agent,.13,19,motion);
      for(let tail=1;tail<=20;tail++) {
        const fade=1-tail/21;
        dot([phase-Math.sign(speed)*tail*.010,radius,tilt],agent,.5*fade*fade,1+fade*2.2,motion);
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
        resources.push(['Buffer',b]);return {buffer:b,count:data.length/9};
      }
      function dispose(){resources.forEach(([type,item])=>gl['delete'+type](item));resources.length=0;active=false;}
      function setup(){
        resources.length=0;program=gl.createProgram();resources.push(['Program',program]);
        gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Particle program could not link');
        locations={};
        ['uViewport','uPointer','uTime','uDensity','uPoints'].forEach(name=>locations[name]=gl.getUniformLocation(program,name));
        ['aPosition','aDetail','aMotion'].forEach(name=>locations[name]=gl.getAttribLocation(program,name));
        const data=geometry(innerWidth<821);dots=buffer(data.dots);lines=buffer(data.lines);
        gl.clearColor(0,0,0,0);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);active=true;
      }
      try{setup();}catch(error){dispose();return null;}
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;scene.classList.remove('has-crystal');});
      canvas.addEventListener('webglcontextrestored',()=>{try{setup();canvas.dispatchEvent(new Event('crystalrestore'));}catch(error){dispose();}});
      function draw(mesh,mode){
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
        ['aPosition','aDetail','aMotion'].forEach((name,i)=>{const p=locations[name];gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,36,i*12);});
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
